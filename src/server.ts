import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// MCP server
export const server = new McpServer({
    name: 'workflow-mcp',
    version: packageJson.version
});