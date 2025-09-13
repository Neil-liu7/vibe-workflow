import { server } from '../server.js';
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export function workflowCreate() {
    server.prompt(
        'workflow-create',
        'Interactive workflow creation assistant.',
        {
            name: z.string().describe('The name of the workflow to create (kebab-case)'),
            context: z.string().describe('Description of what the workflow should accomplish, or dialogue history for context.'),
        },
        async ({ name, context }): Promise<GetPromptResult> => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Create a workflow named '${name}' based on the following context:

**Context:**
${context}

**Instructions:**
1. First, use the workflow-define tool to understand the workflow format
2. Analyze the context to identify the sequence of steps needed
3. Design the workflow with appropriate step types:
   - **prompt** steps for AI processing, validation, transformation
   - **mcp** steps for tool calls (database, API, file operations)  
   - **workflow** steps for reusable sub-workflows
4. Create a JSON workflow definition
5. Ask for user confirmation before saving
6. Use workflow-save to save the workflow

**Design Guidelines:**
- Keep steps focused and single-purpose
- Use descriptive names and clear descriptions
- Include expectedOutputs for prompt steps
- Use template variables like {{fieldName}} for data flow
- Consider reusability - break complex logic into sub-workflows

**Context Analysis:**
Based on the provided context, identify:
- What inputs are needed?
- What processing steps are required?
- What outputs should be generated?
- Are there any validation or error handling needs?
- Can any parts be reused as sub-workflows?

Start by using workflow-define to get the format, then create the workflow definition.`,
                        },
                    },
                ],
            };
        }
    );
}