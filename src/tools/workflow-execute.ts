import { server } from '../server.js';
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { z } from "zod";

// Helper function to load and flatten workflow
async function loadAndFlattenWorkflow(workflowName: string, projectPath: string, visited = new Set<string>()): Promise<{
    name: string;
    description: string;
    expectedOutputs?: string[];
    flattenedSteps: any[];
}> {
    if (visited.has(workflowName)) {
        throw new Error(`Circular workflow dependency detected: ${workflowName}`);
    }
    visited.add(workflowName);

    const fileName = `${projectPath}/.workflow/${workflowName}.json`;
    const content = await readFile(fileName, { encoding: 'utf8' });
    const workflow = JSON.parse(content);

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
        throw new Error(`Invalid workflow '${workflowName}': missing or invalid steps array`);
    }

    const flattenedSteps = [];
    
    for (const step of workflow.steps) {
        if (step.type === 'workflow') {
            // Recursively flatten sub-workflow steps
            const subWorkflow = await loadAndFlattenWorkflow(step.workflow, projectPath, new Set(visited));
            flattenedSteps.push(...subWorkflow.flattenedSteps.map(s => ({
                ...s,
                _sourceWorkflow: step.workflow,
                _parentDescription: step.description
            })));
        } else {
            // Add step with metadata
            flattenedSteps.push({
                ...step,
                _sourceWorkflow: workflowName
            });
        }
    }

    return {
        name: workflow.name,
        description: workflow.description,
        expectedOutputs: workflow.expectedOutputs,
        flattenedSteps
    };
}

export function workflowExecute(projectPath: string) {
    server.prompt(
        "workflow-execute",
        "Execute a complete workflow with flattened steps.",
        {
            name: z.string().describe("Name of the workflow to execute."),
            inputs: z.any().describe("Initial inputs for the workflow."),
        },
        async ({ name, inputs }): Promise<GetPromptResult> => {
            try {
                const workflow = await loadAndFlattenWorkflow(name, projectPath);
                
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `Execute workflow '${name}': ${workflow.description}

**Execution Plan (${workflow.flattenedSteps.length} steps):**
${workflow.flattenedSteps.map((step, i) => {
    const source = step._sourceWorkflow !== name ? ` (from ${step._sourceWorkflow})` : '';
    const desc = step.description || step.template?.substring(0, 60) + '...' || 'No description';
    return `${i + 1}. [${step.type.toUpperCase()}] ${desc}${source}`;
}).join('\n')}

**Initial Data:**
${JSON.stringify(inputs, null, 2)}

**Expected Final Outputs:** ${workflow.expectedOutputs ? JSON.stringify(workflow.expectedOutputs) : 'Not specified'}

---

**EXECUTION INSTRUCTIONS:**

Execute ALL steps sequentially. For each step:

**PROMPT STEPS:**
- Use the template with {{variable}} substitution from available data
- Follow the description and expectedOutputs guidance  
- Apply any hints provided
- Add new fields to the data object (don't replace existing data)

**MCP STEPS:**
- Call the specified MCP tool using inputMapping to map data fields to tool parameters
- Add the tool's outputs to the data object

**DATA FLOW:**
- Start with the initial inputs
- Each step adds new fields to the growing data object
- Later steps can reference any field from previous steps
- Preserve all data throughout execution

**TEMPLATE SUBSTITUTION:**
- Replace {{fieldName}} with actual values from current data
- If a field doesn't exist, note it and continue with available data

Execute all ${workflow.flattenedSteps.length} steps now and return the final data object.

**STEPS TO EXECUTE:**

${workflow.flattenedSteps.map((step, i) => `
**Step ${i + 1}: ${step.type.toUpperCase()}**
${step._sourceWorkflow !== name ? `Source: ${step._sourceWorkflow}` : ''}
${JSON.stringify(step, null, 2)}
`).join('\n')}

Begin execution now.`,
                            },
                        },
                    ],
                };
            } catch (error) {
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `❌ Error loading workflow '${name}': ${error instanceof Error ? error.message : String(error)}

**Troubleshooting:**
1. Check that ${projectPath}/.workflow/${name}.json exists
2. Verify the JSON is valid
3. Ensure all referenced sub-workflows exist
4. Check for circular dependencies

**Available workflows:** List files in ${projectPath}/.workflow/ to see available workflows.`,
                            },
                        },
                    ],
                };
            }
        }
    );
}