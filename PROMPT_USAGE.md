# Prompt 管理功能使用指南

本项目已集成了强大的 Prompt 管理功能，参考了 mcp-prompt-server 的设计，使用 TypeScript 重新实现。

## 功能特性

- 📁 **Prompt 文件管理**: 支持 YAML 和 JSON 格式的 prompt 文件
- 🔄 **动态加载**: 自动扫描和加载 prompts 目录中的所有 prompt 文件
- 🎯 **参数替换**: 支持 `{{参数名}}` 格式的动态参数替换
- 📋 **列表查看**: 快速查看所有可用的 prompt 及其描述
- 🔍 **详情查询**: 获取 prompt 的详细信息，包括参数列表
- ⚡ **即时执行**: 直接执行 prompt 并获取结果

## 可用工具

### 1. `load_prompts`
重新加载所有预设的 prompts

### 2. `list_prompts`
获取所有可用的 prompt 名称和描述

### 3. `get_prompt`
获取指定 prompt 的详细信息

### 4. `execute_prompt`
执行指定的 prompt，支持参数替换

## 内置示例 Prompts

项目已包含以下示例 prompts：

1. **code_review**: 代码审查助手
   - 分析代码质量、发现潜在问题
   - 参数: `code`, `language`, `focus`

2. **doc_generator**: 文档生成助手
   - 根据代码或需求生成技术文档
   - 参数: `content`, `doc_type`, `audience`

3. **code_generator**: 代码生成助手
   - 根据需求描述生成代码实现
   - 参数: `requirement`, `language`, `framework`