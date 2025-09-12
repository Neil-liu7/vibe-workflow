import { server } from '../server.js';
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { z } from "zod";

export function workflowRun(projectPath: string) {
    server.prompt(
        "workflow-run",
        "Run a step in a workflow. Tip: Use this tool recursively to run all steps in a workflow.",
        {
            name: z.string().describe("Name of the workflow."),
            step: z.string().optional().describe("Step number to run. Default to 1."),
            inputs: z.any().describe("Inputs of the step."),
        },
        async ({ name, step, inputs }): Promise<GetPromptResult> => {
            try {
                const fileName = projectPath + '/.workflow/' + name + '.md';
                const content = await readFile(fileName, { encoding: 'utf8' });
                const obj = JSON.parse(content);

                // default to step 1
                if (!step) {
                    step = '1';
                }

                // error handling
                if (Number(step) < 1) {
                    return {
                        messages: [
                            {
                                role: 'assistant',
                                content: {
                                    type: 'text',
                                    text: `Error: Step number must be greater than 0.`,
                                },
                            },
                        ],
                    };
                }

                // ending condition
                if (Number(step) > obj.steps.length) {
                    return {
                        messages: [
                            {
                                role: 'assistant',
                                content: {
                                    type: 'text',
                                    text: `Workflow '${name}' run successfully. All ${obj.steps.length} steps have been completed. Final outputs are: ${JSON.stringify(inputs)}`,
                                },
                            },
                        ],
                    };
                }

                const currentStep = obj.steps[Number(step) - 1];
                const nextStep = Number(step) + 1;

                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `You are running step ${step} of workflow '${name}'.

**Step Definition:**
${JSON.stringify(currentStep, null, 2)}

**Current Inputs:**
${JSON.stringify(inputs, null, 2)}

**Instructions:**
1. Execute the current step based on its type and definition
2. Transform the inputs according to the step's requirements
3. Generate outputs that match the step's output schema
4. After completing this step, use the workflow-run tool again with step=${nextStep} and the generated outputs

**Step Types:**
- **prompt**: Execute the template with input substitution
- **mcp**: Call the specified MCP tool with the inputs
- **workflow**: Call the sub-workflow with the inputs

Please execute this step now.`,
                            },
                        },
                    ],
                };
            } catch (error) {
                return {
                    messages: [
                        {
                            role: 'assistant',
                            content: {
                                type: 'text',
                                text: `Error running workflow '${name}': ${error instanceof Error ? error.message : String(error)}`,
                            },
                        },
                    ],
                };
            }
        }
    );
}