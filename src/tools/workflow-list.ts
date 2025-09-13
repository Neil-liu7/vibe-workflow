import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { server } from '../server.js';
import { readdir, readFile } from "fs/promises";
import { join } from "path";

export function workflowList(projectPath: string) {
    server.tool(
        "workflow-list",
        "List all available workflows in the project with their descriptions and metadata.",
        {},
        async (): Promise<CallToolResult> => {
            try {
                const workflowDir = join(projectPath, '.workflow');

                // Read all JSON files in the workflow directory
                const files = await readdir(workflowDir);
                const workflowFiles = files.filter(file => file.endsWith('.json'));

                if (workflowFiles.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: "No workflows found in the project.\n\nTo create a workflow, use the workflow-create or workflow-save tools."
                        }]
                    };
                }

                // Load and parse each workflow file
                const workflows = [];
                for (const file of workflowFiles) {
                    try {
                        const filePath = join(workflowDir, file);
                        const content = await readFile(filePath, 'utf8');
                        const workflow = JSON.parse(content);

                        const workflowName = file.replace('.json', '');
                        workflows.push({
                            name: workflowName,
                            displayName: workflow.name || workflowName,
                            description: workflow.description || 'No description provided',
                            expectedOutputs: workflow.expectedOutputs || [],
                            initialInputs: workflow.initialInputs || {},
                            stepCount: workflow.steps ? workflow.steps.length : 0,
                            file: file
                        });
                    } catch (parseError) {
                        workflows.push({
                            name: file.replace('.json', ''),
                            displayName: file,
                            description: `❌ Error parsing workflow: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                            expectedOutputs: [],
                            initialInputs: {},
                            stepCount: 0,
                            file: file,
                            error: true
                        });
                    }
                }

                // Sort workflows by name
                workflows.sort((a, b) => a.name.localeCompare(b.name));

                // Format the output as JSON with only name and description
                const workflowList = workflows.map(workflow => ({
                    name: workflow.name,
                    description: workflow.description
                }));

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(workflowList, null, 2)
                    }]
                };

            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Error listing workflows: ${error instanceof Error ? error.message : String(error)}

**Troubleshooting:**
1. Check that ${projectPath}/.workflow/ directory exists
2. Verify you have read permissions
3. Ensure workflow files are valid JSON

**Directory path:** ${join(projectPath, '.workflow')}`
                    }]
                };
            }
        }
    );
}