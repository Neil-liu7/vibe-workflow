import { server } from '../server.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { z } from 'zod';
import yaml from 'js-yaml';
import { Prompt, PromptListItem, PromptExecutionResult } from '../types/prompt.js';

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
      const promptFiles = files.filter(file =>
        file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')
      );

      for (const file of promptFiles) {
        try {
          const filePath = join(this.promptsDir, file);
          const content = readFileSync(filePath, 'utf8');

          let prompt: Prompt;
          if (file.endsWith('.json')) {
            prompt = JSON.parse(content);
          } else {
            prompt = yaml.load(content) as Prompt;
          }

          if (!prompt.name) {
            await server.sendLoggingMessage({
              level: "warning",
              data: `Warning: Prompt in ${file} is missing a name field. Skipping.`
            });
            continue;
          }

          // 添加文件信息
          const stats = statSync(filePath);
          prompt.createdAt = stats.birthtime.toISOString();
          prompt.updatedAt = stats.mtime.toISOString();

          this.loadedPrompts.set(prompt.name, prompt);
          prompts.push(prompt);
        } catch (error) {
          await server.sendLoggingMessage({
            level: "error",
            data: `Error loading prompt from ${file}: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }

      await server.sendLoggingMessage({
        level: "info",
        data: `Loaded ${prompts.length} prompts from ${this.promptsDir}`
      });
      return prompts;
    } catch (error) {
      await server.sendLoggingMessage({
        level: "error",
        data: `Error loading prompts: ${error instanceof Error ? error.message : String(error)}`
      });
      return [];
    }
  }



  /**
   * 获取prompts目录路径
   */
  getPromptsDir(): string {
    return this.promptsDir;
  }

  /**
   * 获取prompt列表
   */
  getPromptList(): PromptListItem[] {
    return Array.from(this.loadedPrompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      argumentCount: prompt.arguments?.length || 0,
      filePath: join(this.promptsDir, `${prompt.name}.yaml`),
      createdAt: prompt.createdAt,
      author: prompt.author,
      tags: prompt.tags
    }));
  }

  /**
   * 获取指定prompt
   */
  getPrompt(name: string): Prompt | undefined {
    return this.loadedPrompts.get(name);
  }

  /**
   * 保存prompt
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    const filePath = join(this.promptsDir, `${prompt.name}.yaml`);
    const yamlContent = this.promptToYaml(prompt);
    writeFileSync(filePath, yamlContent, 'utf8');

    // 更新内存中的prompt
    prompt.updatedAt = new Date().toISOString();
    this.loadedPrompts.set(prompt.name, prompt);
  }

  /**
   * 将Prompt对象转换为YAML格式
   */
  private promptToYaml(prompt: Prompt): string {
    let yaml = `name: ${prompt.name}\n`;
    if (prompt.description) {
      yaml += `description: ${prompt.description}\n`;
    }
    if (prompt.author) {
      yaml += `author: ${prompt.author}\n`;
    }
    if (prompt.version) {
      yaml += `version: ${prompt.version}\n`;
    }
    if (prompt.tags && prompt.tags.length > 0) {
      yaml += `tags: [${prompt.tags.join(', ')}]\n`;
    }

    yaml += `arguments:\n`;
    if (prompt.arguments && prompt.arguments.length > 0) {
      for (const arg of prompt.arguments) {
        yaml += `  - name: ${arg.name}\n`;
        if (arg.description) {
          yaml += `    description: ${arg.description}\n`;
        }
        if (arg.type) {
          yaml += `    type: ${arg.type}\n`;
        }
        if (arg.required !== undefined) {
          yaml += `    required: ${arg.required}\n`;
        }
      }
    } else {
      yaml += `  []\n`;
    }

    yaml += `messages:\n`;
    for (const message of prompt.messages) {
      yaml += `  - role: ${message.role}\n`;
      yaml += `    content:\n`;
      yaml += `      type: ${message.content.type}\n`;
      yaml += `      text: |\n`;
      const textLines = message.content.text.split('\n');
      for (const line of textLines) {
        yaml += `        ${line}\n`;
      }
    }

    return yaml;
  }

  /**
   * 执行prompt
   */
  executePrompt(name: string, args: Record<string, any> = {}): PromptExecutionResult {
    const prompt = this.getPrompt(name);
    if (!prompt) {
      return {
        success: false,
        error: `Prompt '${name}' not found`
      };
    }

    try {
      let promptText = '';

      // 确保messages是数组
      if (!prompt.messages || !Array.isArray(prompt.messages)) {
        return {
          success: false,
          error: `Invalid messages format in prompt '${name}': expected array, got ${typeof prompt.messages}`,
          usedArguments: args
        };
      }

      // 处理用户消息
      const userMessages = prompt.messages.filter(msg => msg.role === 'user');

      for (const message of userMessages) {
        if (message.content && message.content.text) {
          let text = message.content.text;

          // 替换所有 {{arg}} 格式的参数
          for (const [key, value] of Object.entries(args)) {
            text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          }

          promptText += text + '\n\n';
        }
      }

      return {
        success: true,
        content: promptText.trim(),
        usedArguments: args
      };
    } catch (error) {
      return {
        success: false,
        error: `Error executing prompt: ${error instanceof Error ? error.message : String(error)}`,
        usedArguments: args
      };
    }
  }
}

/**
 * 注册prompt管理相关的工具
 */
export async function registerPromptTools(projectPath: string) {
  const promptManager = new PromptManager(projectPath);

  // 加载所有预设的prompts
  const loadedPrompts = await promptManager.loadPrompts();

  // 为每个预设的prompt创建一个工具 
  loadedPrompts.forEach(prompt => { 
    // 构建工具的输入schema 
    const schemaObj: Record<string, any> = {}; 
    
    if (prompt.arguments && Array.isArray(prompt.arguments)) { 
      prompt.arguments.forEach(arg => { 
        // 默认所有参数都是字符串类型 
        schemaObj[arg.name] = z.string().describe(arg.description || `参数: ${arg.name}`); 
      }); 
    } 
    
    // 注册工具 
    server.tool( 
      prompt.name, 
      prompt.description || `Prompt: ${prompt.name}`, 
      schemaObj, 
      async (args: any) => { 
        // 处理prompt内容 
        let promptText = ''; 
        
        if (prompt.messages && Array.isArray(prompt.messages)) { 
          // 只处理用户消息 
          const userMessages = prompt.messages.filter(msg => msg.role === 'user'); 
          
          for (const message of userMessages) { 
            if (message.content && typeof message.content.text === 'string') { 
              let text = message.content.text; 
              
              // 替换所有 {{arg}} 格式的参数 
              for (const [key, value] of Object.entries(args)) { 
                text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value)); 
              } 
              
              promptText += text + '\n\n'; 
            } 
          } 
        } 
        
        // 返回处理后的prompt内容 
        return { 
          content: [ 
            { 
              type: "text", 
              text: promptText.trim() 
            } 
          ] 
        }; 
      } 
    ); 
  });

  // 添加prompt列表工具
  server.tool(
    'prompt_list',
    '展示所有可用的prompt模版工具方法',
    {},
    async () => {
      const jsonFilePath = join(dirname(promptManager.getPromptsDir()), 'prompt-list.json');
      
      try {
        // 每次都从prompts文件夹重新扫描YAML文件
        await promptManager.loadPrompts();
        const promptList = promptManager.getPromptList();
        
        // 将最新的prompt信息保存到JSON文件
        const jsonData = {
          lastUpdated: new Date().toISOString(),
          totalCount: promptList.length,
          prompts: promptList
        };
        writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
        
        if (promptList.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '当前没有可用的prompt模版工具。'
              }
            ]
          };
        }

        const promptInfo = promptList.map(prompt => {
          const args = prompt.argumentCount > 0 ? ` (${prompt.argumentCount}个参数)` : ' (无参数)';
          return `🔧 **${prompt.name}**${args}\n   📝 ${prompt.description || '无描述'}\n   📁 ${prompt.filePath}`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `## 可用的Prompt模版工具 (${promptList.length}个)\n\n${promptInfo}\n\n💡 **使用方法**: 直接调用对应的工具名称即可，例如调用 \`gen_3d_webpage_html\` 工具。\n\n📄 **JSON文件已更新**: ${jsonFilePath}\n🕒 **更新时间**: ${jsonData.lastUpdated}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 扫描prompt文件夹时出错: ${error instanceof Error ? error.message : '未知错误'}`
            }
          ]
        };
      }
    }
  );

  // 注册完成，所有prompt都已转换为独立的工具方法
}