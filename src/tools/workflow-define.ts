import { server } from '../server.js';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export function workflowDefine() {
    server.tool(
        'workflow-define',
        'Provides definitions for creating a workflow',
        {},
        async ({ }): Promise<CallToolResult> => {
            return {
                content: [
                    {
                        type: "text",
                        text: `# Workflow

## Overview

A Workflow is a series of steps that are executed in order.
Workflow must have a name using kebab-case (e.g., user-authentication), so that Workflow can be referenced as a step in other Workflows.
Workflow must have at least one step.
Each step must define inputs and.
Each step must include a description that explains how the step transforms its inputs into its outputs.
The Final step's outputs are the outputs of the Workflow.
Inputs and Outputs of a Step must be a valid json format.

Each step can be a single prompt or a MCP tool or a sub-workflow.
Steps can only use at most ONE MCP tool, keep the Step Simple.
Workflow can be nested, but a Workflow CANNOT call itself recursively.

## Inputs/Outpus Definition
Inputs/Outpus are key-value pairs, where key is the name, value is the type.
Input/Output types are defined as follows:
- string
- number
- boolean
- object
- array

## Workflow Definition
Workflow definition is a json file, which contains the following fields:
- name: string, required, kebab-case, (e.g. 'user-authentication').
- desc: string, required, a brief description of the workflow process.
- steps: array, required, at least one step.
- inputs: object, required, must match the inputs of the first step
- outputs: object, required, must match the outputs of the final step

### Step Definition
Each step is a json object, different step types have different fields.

#### Prompt Step
Prompt step takes a prompt template, replace the placeholders with the input values, and use the MCP tool 'workflow-run-step' to return the result.
- type: string, 'prompt'
- template: string, the prompt template, must contain placeholders in the format {{placeholder}} , and explain how to generate its outputs.
- inputs: object, required, must match the placeholders in the prompt template.
- outputs: object, required, must match the outputs defined in the prompt template.

#### MCP Step
MCP step uses a MCP tool to process the inputs and return the outputs.
- type: string, 'mcp'
- tool: string, required, must be a valid MCP tool name
- inputs: object, required, must match the inputs of the MCP tool
- outputs: object, required, must match the outputs of the MCP tool

#### Sub-workflow Step
Sub-workflow step calls another workflow to process the inputs and return the outputs.
- type: string, 'workflow'
- workflow: string, required, must be a valid workflow name
- inputs: object, required, must match the inputs of the sub-workflow
- outputs: object, required, must match the outputs of the sub-workflow

## Example

\`\`\`json
{
  "name": "user-authentication",
  "desc": "Authenticate user with email and password",
  "inputs": {
    "email": "string",
    "password": "string"
  },
  "outputs": {
    "success": "boolean",
    "token": "string",
    "user": "object"
  },
  "steps": [
    {
      "type": "prompt",
      "template": "Validate email format: {{email}}. Return {valid: boolean, message: string}",
      "inputs": {
        "email": "string"
      },
      "outputs": {
        "valid": "boolean",
        "message": "string"
      }
    },
    {
      "type": "mcp",
      "tool": "database-query",
      "inputs": {
        "email": "string",
        "password": "string"
      },
      "outputs": {
        "success": "boolean",
        "token": "string",
        "user": "object"
      }
    }
  ]
}
\`\`\`
`
                    },
                ],
            };
        }
    );
}