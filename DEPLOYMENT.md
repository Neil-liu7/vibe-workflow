# 将 Workflow MCP 部署到本地 TRAE

本指南将帮助您将 Workflow MCP 服务器部署到本地的 TRAE 环境中。

## 前置要求

- Node.js (版本 18 或更高)
- npm 或 yarn
- TRAE IDE

## 部署步骤

### 1. 构建项目

首先，确保项目已正确构建：

```bash
npm install
npm run build
```

### 2. 配置 TRAE MCP

在 TRAE 中配置 MCP 服务器有两种方式：

#### 方式一：使用项目内的配置文件

1. 打开 TRAE IDE
2. 进入设置 → MCP 配置
3. 导入项目中的 `.vscode/mcp.json` 配置文件
4. 确保路径指向正确的 `dist/index.js` 文件

#### 方式二：手动配置

在 TRAE 的 MCP 配置中添加以下配置：

```json
{
  "servers": {
    "workflow": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/Users/neilliu/Desktop/vibe-contest/work-flow-mcp/dist/index.js"
      ],
      "cwd": "/Users/neilliu/Desktop/vibe-contest/work-flow-mcp"
    }
  }
}
```

**注意：** 请将路径替换为您的实际项目路径。

### 3. 验证部署

1. 重启 TRAE IDE
2. 在 TRAE 中打开任意项目
3. 尝试使用以下工具验证 MCP 服务器是否正常工作：
   - `prompt_list` - 查看可用的 prompt 模板
   - `prompt_usage_stats` - 查看使用统计
   - 任意 prompt 工具（如 `gen_3d_webpage_html`）

## 可用功能

部署成功后，您将可以使用以下功能：

### Prompt 管理工具
- `prompt_list` - 查看所有可用的 prompt 模板
- `prompt_usage_stats` - 查看 prompt 使用统计
- `prompt_submit` - 提交新的提示词模板到系统中
- `prompt_dashboard` - 生成可视化的prompt使用统计dashboard网页
- 各种预设 prompt 工具：
  - `gen_3d_webpage_html` - 生成3D网页HTML
  - `gen_bento_grid_html` - 生成Bento网格布局
  - `gen_knowledge_card_html` - 生成知识卡片
  - `gen_magazine_card_html` - 生成杂志卡片
  - `gen_podcast_script` - 生成播客脚本
  - `gen_prd_prototype_html` - 生成产品原型

### Workflow 管理工具
- `workflow_create` - 创建新的工作流
- `workflow_define` - 定义工作流步骤
- `workflow_run` - 执行工作流
- `workflow_save` - 保存工作流配置

## 故障排除

### 常见问题

1. **MCP 服务器无法启动**
   - 检查 Node.js 版本是否符合要求
   - 确保项目已正确构建（`npm run build`）
   - 检查路径配置是否正确

2. **工具无法找到**
   - 确保 TRAE 已重启
   - 检查 MCP 配置是否正确加载
   - 查看 TRAE 的 MCP 日志

3. **统计功能不工作**
   - 确保项目目录有写入权限
   - 检查是否生成了 `prompt-usage-stats.json` 文件

### 日志查看

如果遇到问题，可以查看 TRAE 的 MCP 日志来诊断问题。日志通常包含服务器启动信息和错误详情。

## 更新部署

当代码有更新时，需要重新构建并重启：

```bash
npm run build
```

然后重启 TRAE IDE 以加载新的更改。

## 支持

如果遇到部署问题，请检查：
1. 项目依赖是否正确安装
2. 构建是否成功
3. TRAE MCP 配置是否正确
4. 文件路径是否存在且可访问