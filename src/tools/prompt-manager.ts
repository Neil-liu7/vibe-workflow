import { server } from '../server.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { z } from 'zod';
import yaml from 'js-yaml';
import { Prompt, PromptListItem, PromptExecutionResult, PromptUsageStats, UsageStatsSummary } from '../types/prompt.js';

/**
 * Prompt管理器类
 */
export class PromptManager {
  private promptsDir: string;
  private loadedPrompts: Map<string, Prompt> = new Map();
  private usageStatsFile: string;
  private usageStats: Map<string, PromptUsageStats> = new Map();

  constructor(projectPath: string) {
    this.promptsDir = join(projectPath, 'prompts');
    this.usageStatsFile = join(projectPath, 'prompt-usage-stats.json');
    this.ensurePromptsDir();
    this.loadUsageStats();
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
   * 加载使用统计数据
   */
  private loadUsageStats(): void {
    try {
      if (existsSync(this.usageStatsFile)) {
        const content = readFileSync(this.usageStatsFile, 'utf8');
        const stats = JSON.parse(content) as PromptUsageStats[];
        this.usageStats.clear();
        stats.forEach(stat => {
          this.usageStats.set(stat.name, stat);
        });
      }
    } catch (error) {
      console.warn('Failed to load usage stats:', error);
    }
  }

  /**
   * 保存使用统计数据
   */
  private saveUsageStats(): void {
    try {
      const stats = Array.from(this.usageStats.values());
      writeFileSync(this.usageStatsFile, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
      console.warn('Failed to save usage stats:', error);
    }
  }

  /**
   * 记录prompt使用情况
   */
  private recordUsage(name: string, success: boolean, responseTime?: number): void {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    let stats = this.usageStats.get(name);
    if (!stats) {
      stats = {
        name,
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        firstUsed: now,
        dailyUsage: {}
      };
      this.usageStats.set(name, stats);
    }

    stats.totalCalls++;
    if (success) {
      stats.successCalls++;
    } else {
      stats.failedCalls++;
    }
    
    stats.lastUsed = now;
    stats.dailyUsage[today] = (stats.dailyUsage[today] || 0) + 1;
    
    if (responseTime !== undefined) {
      const currentAvg = stats.avgResponseTime || 0;
      const totalCalls = stats.totalCalls;
      stats.avgResponseTime = ((currentAvg * (totalCalls - 1)) + responseTime) / totalCalls;
    }

    this.saveUsageStats();
  }

  /**
   * 生成使用统计汇总
   */
  generateUsageStatsSummary(): UsageStatsSummary {
    this.loadUsageStats();
    const stats = Array.from(this.usageStats.values());
    const totalCalls = stats.reduce((sum, stat) => sum + stat.totalCalls, 0);
    const totalSuccess = stats.reduce((sum, stat) => sum + stat.successCalls, 0);
    const activePrompts = stats.filter(stat => stat.totalCalls > 0).length;
    
    let mostPopular = '';
    let maxCalls = 0;
    stats.forEach(stat => {
      if (stat.totalCalls > maxCalls) {
        maxCalls = stat.totalCalls;
        mostPopular = stat.name;
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      totalPrompts: this.loadedPrompts.size,
      activePrompts,
      totalCalls,
      successRate: totalCalls > 0 ? (totalSuccess / totalCalls) * 100 : 0,
      mostPopular: mostPopular || undefined,
      promptStats: stats
    };
  }

  /**
   * 执行prompt
   */
  executePrompt(name: string, args: Record<string, any> = {}): PromptExecutionResult {
    const startTime = Date.now();
    const prompt = this.getPrompt(name);
    if (!prompt) {
      this.recordUsage(name, false);
      return {
        success: false,
        error: `Prompt '${name}' not found`
      };
    }

    try {
      let promptText = '';

      // 确保messages是数组
      if (!prompt.messages || !Array.isArray(prompt.messages)) {
        const responseTime = Date.now() - startTime;
        this.recordUsage(name, false, responseTime);
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

      const responseTime = Date.now() - startTime;
      this.recordUsage(name, true, responseTime);

      return {
        success: true,
        content: promptText.trim(),
        usedArguments: args
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordUsage(name, false, responseTime);
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
        // 调用executePrompt方法以触发统计功能
        const result = promptManager.executePrompt(prompt.name, args);
        
        if (result.success) {
          // 返回处理后的prompt内容 
          return { 
            content: [ 
              { 
                type: "text", 
                text: result.content || '' 
              } 
            ] 
          }; 
        } else {
          // 返回错误信息
          return { 
            content: [ 
              { 
                type: "text", 
                text: `❌ 执行prompt失败: ${result.error}` 
              } 
            ] 
          }; 
        }
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

  // 添加prompt使用统计工具
  server.tool(
    'prompt_usage_stats',
    '可视化展示prompt模版提示词的使用情况统计',
    {
      format: z.enum(['summary', 'detailed', 'chart']).optional().describe('统计格式: summary(汇总), detailed(详细), chart(图表)'),
      days: z.number().optional().describe('显示最近几天的数据，默认为7天')
    },
    async (args) => {
      const format = args.format || 'summary';
      const days = args.days || 7;
      
      try {
        const summary = promptManager.generateUsageStatsSummary();
        
        if (format === 'summary') {
          return {
            content: [
              {
                type: 'text',
                text: `## 📊 Prompt使用统计汇总\n\n` +
                      `🕒 **生成时间**: ${new Date(summary.generatedAt).toLocaleString('zh-CN')}\n\n` +
                      `📈 **总体统计**:\n` +
                      `- 总prompt数量: ${summary.totalPrompts}\n` +
                      `- 活跃prompt数量: ${summary.activePrompts}\n` +
                      `- 总调用次数: ${summary.totalCalls}\n` +
                      `- 成功率: ${summary.successRate.toFixed(2)}%\n` +
                      `${summary.mostPopular ? `- 最受欢迎: ${summary.mostPopular}\n` : ''}\n` +
                      `💡 **提示**: 使用 \`format: 'detailed'\` 查看详细统计，使用 \`format: 'chart'\` 查看图表展示`
              }
            ]
          };
        }
        
        if (format === 'detailed') {
          const statsText = summary.promptStats
            .sort((a, b) => b.totalCalls - a.totalCalls)
            .map(stat => {
              const successRate = stat.totalCalls > 0 ? (stat.successCalls / stat.totalCalls * 100).toFixed(1) : '0';
              const avgTime = stat.avgResponseTime ? `${stat.avgResponseTime.toFixed(0)}ms` : 'N/A';
              const lastUsed = stat.lastUsed ? new Date(stat.lastUsed).toLocaleString('zh-CN') : '从未使用';
              
              return `🔧 **${stat.name}**\n` +
                     `   📊 调用: ${stat.totalCalls}次 (成功: ${stat.successCalls}, 失败: ${stat.failedCalls})\n` +
                     `   ✅ 成功率: ${successRate}%\n` +
                     `   ⏱️ 平均响应时间: ${avgTime}\n` +
                     `   🕒 最后使用: ${lastUsed}`;
            })
            .join('\n\n');
            
          return {
            content: [
              {
                type: 'text',
                text: `## 📊 Prompt详细使用统计\n\n` +
                      `🕒 **生成时间**: ${new Date(summary.generatedAt).toLocaleString('zh-CN')}\n\n` +
                      `${statsText || '暂无使用数据'}`
              }
            ]
          };
        }
        
        if (format === 'chart') {
          // 生成简单的ASCII图表
          const topPrompts = summary.promptStats
            .sort((a, b) => b.totalCalls - a.totalCalls)
            .slice(0, 10);
            
          const maxCalls = Math.max(...topPrompts.map(p => p.totalCalls), 1);
          const chartText = topPrompts.map(stat => {
            const barLength = Math.round((stat.totalCalls / maxCalls) * 20);
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            return `${stat.name.padEnd(20)} │${bar}│ ${stat.totalCalls}`;
          }).join('\n');
          
          // 生成最近几天的使用趋势
          const recentDays = [];
          for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            recentDays.push(date.toISOString().split('T')[0]);
          }
          
          const dailyTotals = recentDays.map(date => {
            const total = summary.promptStats.reduce((sum, stat) => {
              return sum + (stat.dailyUsage[date] || 0);
            }, 0);
            return { date, total };
          });
          
          const maxDaily = Math.max(...dailyTotals.map(d => d.total), 1);
          const trendChart = dailyTotals.map(day => {
            const barLength = Math.round((day.total / maxDaily) * 15);
            const bar = '▓'.repeat(barLength) + '░'.repeat(15 - barLength);
            const dateStr = new Date(day.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            return `${dateStr.padEnd(8)} │${bar}│ ${day.total}`;
          }).join('\n');
          
          return {
            content: [
              {
                type: 'text',
                text: `## 📊 Prompt使用图表统计\n\n` +
                      `🕒 **生成时间**: ${new Date(summary.generatedAt).toLocaleString('zh-CN')}\n\n` +
                      `### 🏆 Top 10 最受欢迎的Prompt\n\`\`\`\n` +
                      `${'Prompt名称'.padEnd(20)} │${'使用频率'.padEnd(20)}│ 次数\n` +
                      `${'─'.repeat(20)} │${'─'.repeat(20)}│ ────\n` +
                      `${chartText}\n\`\`\`\n\n` +
                      `### 📈 最近${days}天使用趋势\n\`\`\`\n` +
                      `${'日期'.padEnd(8)} │${'使用量'.padEnd(15)}│ 次数\n` +
                      `${'─'.repeat(8)} │${'─'.repeat(15)}│ ────\n` +
                      `${trendChart}\n\`\`\`\n\n` +
                      `💡 **说明**: █▓ 表示使用频率，░ 表示空白区域`
              }
            ]
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: '❌ 不支持的格式类型'
            }
          ]
        };
        
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 生成使用统计时出错: ${error instanceof Error ? error.message : '未知错误'}`
            }
          ]
        };
      }
    }
  );

  // 注册完成，所有prompt都已转换为独立的工具方法
}