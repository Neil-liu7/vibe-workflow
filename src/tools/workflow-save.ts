import { server } from '../server.js';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { writeFile, mkdir } from "fs/promises";
import { z } from "zod";
import { dirname } from "path";

export function workflowSave(projectPath: string) {
    server.tool(
        "workflow-save",
        "Saves a workflow definition to the project directory.",
        {
            name: z.string().describe("Name of the workflow, user defined in kebab-case, string only."),
            content: z.string().describe("Workflow execution flow in Json format."),
        },
        async ({ name, content }, extra): Promise<CallToolResult> => {
            const workflowDir = projectPath + '/.workflow';
            const fileName = workflowDir + '/' + name + '.md';
            
            try {
                // Ensure the .workflow directory exists
                await mkdir(workflowDir, { recursive: true });
                
                await server.sendLoggingMessage({
                    level: "info",
                    data: `Saving workflow '${name}' to ${fileName}`
                }, extra.sessionId);
                
                await writeFile(fileName, content, { encoding: 'utf8' });
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Workflow '${name}' saved successfully to ${fileName}.`,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error saving workflow '${name}': ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
}