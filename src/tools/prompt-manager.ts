import { server } from '../server.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { z } from 'zod';
import { Prompt, PromptListItem, PromptExecutionResult } from '../types/prompt.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * 简单的YAML解析器
 */
class SimpleYamlParser {
  /**
   * 解析YAML内容为JavaScript对象
   */
  static parse(content: string): any {
    const lines = content.split('\n');
    const result: any = {};
    let currentKey = '';
    let currentValue = '';
    let inMultilineValue = false;
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // 检测缩进级别
      const currentIndent = line.length - line.trimStart().length;

      // 处理多行值
      if (inMultilineValue) {
        if (currentIndent > indentLevel || trimmedLine.startsWith('-')) {
          currentValue += (currentValue ? '\n' : '') + line.substring(indentLevel);
          continue;
        } else {
          // 多行值结束
          result[currentKey] = currentValue.trim();
          inMultilineValue = false;
          currentKey = '';
          currentValue = '';
        }
      }

      // 解析键值对
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (value === '' || value === '|' || value === '>') {
          // 开始多行值
          currentKey = key;
          currentValue = '';
          inMultilineValue = true;
          indentLevel = currentIndent + 2;
        } else {
          // 单行值
          result[key] = this.parseValue(value);
        }
      }
    }

    // 处理最后的多行值
    if (inMultilineValue && currentKey) {
      result[currentKey] = currentValue.trim();
    }

    return result;
  }

  /**
   * 解析值的类型
   */
  private static parseValue(value: string): any {
    // 移除引号
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;

    // 数字
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // 数组（简单支持）
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map(item => item.trim());
      return items.map(item => this.parseValue(item));
    }

    return value;
  }
}

/**
 * Prompt管理器类
 */
export class PromptManager {
  private promptsDir: string;
  private loadedPrompts: Map<string, Prompt> = new Map();

  constructor(projectPath: string) {
    this.promptsDir = join(projectPath, 'prompts');
    this.ensurePromptsDir();
  }

  /**
   * 确保prompts目录存在
   */
  private ensurePromptsDir(): void {
    if (!existsSync(this.promptsDir)) {
      mkdirSync(this.promptsDir, { recursive: true });
    }
  }

  /**
   * 加载所有prompts
   */
  async loadPrompts(): Promise<Prompt[]> {
    this.loadedPrompts.clear();
    const prompts: Prompt[] = [];

    try {
      const files = readdirSync(this.promptsDir);
      
      for (const file of files) {
        const filePath = join(this.promptsDir, file);
        const stat = statSync(filePath);
        
        if (stat.isFile()) {
          const ext = extname(file).toLowerCase();
          
          if (ext === '.yaml' || ext === '.yml' || ext === '.json') {
            try {
              const prompt = this.loadPromptFile(filePath);
              if (prompt) {
                this.loadedPrompts.set(prompt.name, prompt);
                prompts.push(prompt);
              }
            } catch (error) {
              console.error(`Error loading prompt file ${file}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading prompts directory:', error);
    }

    return prompts;
  }

  /**
   * 加载单个prompt文件
   */
  private loadPromptFile(filePath: string): Prompt | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath).toLowerCase();
      
      let data: any;
      
      if (ext === '.json') {
        data = JSON.parse(content);
      } else if (ext === '.yaml' || ext === '.yml') {
        data = this.parseYaml(content);
      } else {
        return null;
      }

      // 验证必需字段
      if (!data.name || !data.content) {
        console.error(`Invalid prompt file ${filePath}: missing name or content`);
        return null;
      }

      return {
        name: data.name,
        description: data.description || '',
        messages: data.messages || [{
          role: 'user',
          content: {
            type: 'text',
            text: data.content || ''
          }
        }],
        arguments: data.arguments || []
      };
    } catch (error) {
      console.error(`Error parsing prompt file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 简单的YAML解析器
   */
  private parseYaml(content: string): Prompt {
    return SimpleYamlParser.parse(content);
  }

  /**
   * 获取prompt列表
   */
  getPromptList(): PromptListItem[] {
    return Array.from(this.loadedPrompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      argumentCount: prompt.arguments?.length || 0,
      filePath: join(this.promptsDir, `${prompt.name}.yaml`)
    }));
  }

  /**
   * 获取指定prompt
   */
  getPrompt(name: string): Prompt | undefined {
    return this.loadedPrompts.get(name);
  }

  /**
   * 执行prompt
   */
  executePrompt(name: string, args: Record<string, any> = {}): PromptExecutionResult {
    const prompt = this.loadedPrompts.get(name);
    
    if (!prompt) {
      return {
        success: false,
        error: `Prompt '${name}' not found`,
        content: ''
      };
    }

    try {
      // 执行参数替换
      let content = '';
      
      // 从messages中提取文本内容
      if (prompt.messages && prompt.messages.length > 0) {
        content = prompt.messages.map(msg => msg.content.text).join('\n\n');
      }
      
      // 替换参数占位符 {{arg_name}}
      content = content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match: string, argName: string) => {
        const trimmedArgName = argName.trim();
        if (args.hasOwnProperty(trimmedArgName)) {
          return String(args[trimmedArgName]);
        }
        return match; // 保持原样如果参数不存在
      });

      return {
        success: true,
        content: content,
        usedArguments: args
      };
    } catch (error) {
      return {
        success: false,
        error: `Error executing prompt '${name}': ${error instanceof Error ? error.message : String(error)}`,
        content: ''
      };
    }
  }

  /**
   * 创建示例prompt文件
   */
  createExamplePrompts(): void {
    const examplePrompts = [
      {
        name: 'code-review',
        description: 'Code review prompt template',
        content: `Please review the following code:\n\n{{code}}\n\nFocus on:\n- Code quality and best practices\n- Potential bugs or issues\n- Performance considerations\n- Maintainability\n\nLanguage: {{language}}`,
        arguments: [
          { name: 'code', type: 'string', description: 'The code to review' },
          { name: 'language', type: 'string', description: 'Programming language' }
        ]
      },
      {
        name: 'explain-concept',
        description: 'Explain a technical concept',
        content: `Please explain the concept of "{{concept}}" in {{context}}.\n\nTarget audience: {{audience}}\n\nPlease include:\n- Clear definition\n- Key characteristics\n- Practical examples\n- Common use cases`,
        arguments: [
          { name: 'concept', type: 'string', description: 'The concept to explain' },
          { name: 'context', type: 'string', description: 'The context or domain' },
          { name: 'audience', type: 'string', description: 'Target audience level' }
        ]
      }
    ];

    for (const prompt of examplePrompts) {
      const filePath = join(this.promptsDir, `${prompt.name}.yaml`);
      if (!existsSync(filePath)) {
        const yamlContent = `name: ${prompt.name}\ndescription: ${prompt.description}\ncontent: |\n  ${prompt.content.replace(/\n/g, '\n  ')}\narguments:\n${prompt.arguments.map(arg => `  - name: ${arg.name}\n    type: ${arg.type}\n    description: ${arg.description}`).join('\n')}`;
        writeFileSync(filePath, yamlContent, 'utf-8');
      }
    }
  }
}

/**
 * 注册prompt管理相关的工具
 */
export function registerPromptTools(projectPath: string) {
  const promptManager = new PromptManager(projectPath);

  // 创建示例prompts
  promptManager.createExamplePrompts();

  // 注册load_prompts工具
  server.tool(
    'load_prompts',
    '重新加载所有预设的prompts',
    {},
    async (): Promise<CallToolResult> => {
      try {
        const prompts = await promptManager.loadPrompts();
        return {
          content: [
            {
              type: 'text',
              text: `Successfully loaded ${prompts.length} prompts: ${prompts.map(p => p.name).join(', ')}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error loading prompts: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // 注册list_prompts工具
  server.tool(
    'list_prompts',
    '获取所有可用的prompt名称和描述',
    {},
    async (): Promise<CallToolResult> => {
      try {
        const promptList = promptManager.getPromptList();
        const listText = promptList.length > 0 
          ? promptList.map(p => `- **${p.name}**: ${p.description || 'No description'}\n  Arguments: ${p.argumentCount}`).join('\n\n')
          : 'No prompts available. Use load_prompts to load prompts from the prompts directory.';
        
        return {
          content: [
            {
              type: 'text',
              text: `Available Prompts (${promptList.length}):\n\n${listText}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing prompts: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // 注册get_prompt工具
  server.tool(
    'get_prompt',
    '获取指定prompt的详细信息',
    {
      name: z.string().describe('Prompt名称')
    },
    async ({ name }): Promise<CallToolResult> => {
      try {
        const prompt = promptManager.getPrompt(name);
        
        if (!prompt) {
          return {
            content: [
              {
                type: 'text',
                text: `Prompt '${name}' not found. Use list_prompts to see available prompts.`
              }
            ],
            isError: true
          };
        }

        const content = prompt.messages?.map(msg => msg.content.text).join('\n\n') || '';
        const argumentsText = prompt.arguments?.map(arg => `- **${arg.name}** (${arg.type || 'string'}): ${arg.description || 'No description'}`).join('\n') || 'No arguments';
        const promptInfo = `**Name:** ${prompt.name}\n\n**Description:** ${prompt.description || 'No description'}\n\n**Content:**\n\`\`\`\n${content}\n\`\`\`\n\n**Arguments:**\n${argumentsText}`;
        
        return {
          content: [
            {
              type: 'text',
              text: promptInfo
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting prompt: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // 注册execute_prompt工具
  server.tool(
    'execute_prompt',
    '执行指定的prompt，支持参数替换',
    {
      name: z.string().describe('Prompt名称'),
      arguments: z.record(z.any()).optional().describe('Prompt参数，键值对格式')
    },
    async ({ name, arguments: args = {} }): Promise<CallToolResult> => {
      try {
        const result = promptManager.executePrompt(name, args);
        
        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: result.error || 'Unknown error occurred'
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: result.content || ''
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing prompt: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // 初始加载prompts
  promptManager.loadPrompts().catch(console.error);
}