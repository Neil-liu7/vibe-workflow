import { server } from '../server.js';
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export function workflowCreate(projectPath: string) {
    server.prompt(
        'workflow-create',
        'Summarize the context and save the workflow definition in Json format.',
        {
            name: z.string().describe('The name of the workflow to create'),
            context: z.string().describe('The description of the workflow to generate, or a dialogue history to provide descriptive context for the workflow.'),
        },
        async ({ name, context }): Promise<GetPromptResult> => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Get interactive guidance for creating a '${name}' workflow.

**Context:**
${context}

**Instructions:**
1. Use the workflow-define tool to get comprehensive workflow definitions
2. Review the current context and the content to summarize the workflow steps
3. Print the workflow definition in Json format, ALWAYS ask for confirmation before using the workflow-save tool
4. Use the workflow-save tool to save the workflow definition

**Resrictions:**
- Do not make up steps that are not in the context
- Do not include any steps that are not relevant to the context
- Ensure the Json is properly formatted
- Use only the workflow-save tools to save the workflow
`,
                        },
                    },
                ],
            };
        }
    );
}