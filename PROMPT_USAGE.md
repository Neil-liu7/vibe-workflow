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

### `prompt_list`
展示所有可用的prompt模版工具方法，包括工具名称、描述、参数数量和文件路径。

**数据存储方式**: 每次调用时都会重新扫描`prompts`文件夹下的所有YAML文件，提取最新信息并更新JSON文件(`prompt-list.json`)。JSON文件包含以下结构：
- `lastUpdated`: 最后更新时间
- `totalCount`: prompt总数量
- `prompts`: 详细的prompt信息数组

**实时更新**: 确保获取到最新的prompt信息，支持动态添加新的prompt文件。

### 自动生成的Prompt工具
系统会自动扫描 `prompts` 目录中的所有 YAML 文件，并为每个 prompt 创建对应的工具方法。每个 prompt 文件会被转换为一个可直接调用的工具，工具名称与文件名相同。

## 内置 Prompts

项目已包含以下 prompts：

1. **gen_3d_webpage_html**: 3D网页展示生成器
   - 创建令人惊艳的Three.js 3D交互式网页
   - 参数: 无（直接在prompt末尾添加主题内容）

2. **gen_bento_grid_html**: Bento Grid风格单页网站生成器
   - 生成基于 Bento Grid 设计风格的单页HTML网站
   - 参数: 无（在prompt中指定风格和内容）

3. **gen_prd_prototype_html**: 产品需求文档(PRD)与高保真原型设计生成器
   - 生成完整的PRD文档和交互式原型
   - 参数: 无（根据产品概念生成）