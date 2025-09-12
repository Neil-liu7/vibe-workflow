/**
 * Prompt参数定义接口
 */
export interface PromptArgument {
  /** 参数名称 */
  name: string;
  /** 参数描述 */
  description?: string;
  /** 参数类型，默认为string */
  type?: 'string' | 'number' | 'boolean';
  /** 是否必需，默认为true */
  required?: boolean;
  /** 默认值 */
  defaultValue?: string | number | boolean;
}

/**
 * Prompt消息内容接口
 */
export interface PromptMessageContent {
  /** 内容类型 */
  type: 'text';
  /** 文本内容 */
  text: string;
}

/**
 * Prompt消息接口
 */
export interface PromptMessage {
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: PromptMessageContent;
}

/**
 * Prompt定义接口
 */
export interface Prompt {
  /** Prompt名称，用作唯一标识 */
  name: string;
  /** Prompt描述 */
  description?: string;
  /** Prompt参数列表 */
  arguments?: PromptArgument[];
  /** Prompt消息列表 */
  messages: PromptMessage[];
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 作者 */
  author?: string;
  /** 版本 */
  version?: string;
  /** 标签 */
  tags?: string[];
}

/**
 * Prompt执行结果接口
 */
export interface PromptExecutionResult {
  /** 执行是否成功 */
  success: boolean;
  /** 执行结果内容 */
  content?: string;
  /** 错误信息 */
  error?: string;
  /** 使用的参数 */
  usedArguments?: Record<string, any>;
}

/**
 * Prompt列表项接口
 */
export interface PromptListItem {
  /** Prompt名称 */
  name: string;
  /** Prompt描述 */
  description?: string;
  /** 参数数量 */
  argumentCount: number;
  /** 文件路径 */
  filePath: string;
  /** 创建时间 */
  createdAt?: string;
  /** 作者 */
  author?: string;
  /** 标签 */
  tags?: string[];
}