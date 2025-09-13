import { server } from '../server.js';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function workflowDefine() {
    server.tool(
        'workflow-define',
        'Provides definitions for creating a workflow',
        {},
        async (): Promise<CallToolResult> => {
            return {
                content: [
                    {
                        type: "text",
                        text: `# Workflow System

## Overview
A Workflow is a sequence of steps executed by AI with data flowing between steps.
Workflows are flattened during execution - nested workflows are expanded inline.
Each step is executed by the AI with flexible prompt-based processing.

## Workflow Definition
Workflows are JSON files stored in \`.workflow/\` directory with \`.json\` extension.

### Required Fields
- **name**: string, kebab-case (e.g., "user-authentication")
- **description**: string, what this workflow accomplishes
- **steps**: array, at least one step

### Optional Fields  
- **expectedOutputs**: array of strings, final output field names
- **initialInputs**: object, expected input structure (for documentation)

## Step Types

### Prompt Step (Flexible AI Processing)
\`\`\`json
{
  "type": "prompt",
  "description": "What this step accomplishes",
  "template": "Process {{input}} and generate {{expectedOutput}}",
  "expectedOutputs": ["field1", "field2"],
  "hints": "Additional guidance for AI"
}
\`\`\`

### MCP Step (Tool Call)
\`\`\`json
{
  "type": "mcp", 
  "tool": "tool-name",
  "description": "What this tool does",
  "inputMapping": {
    "toolParam": "{{dataField}}"
  }
}
\`\`\`

### Workflow Step (Sub-workflow - Gets Flattened)
\`\`\`json
{
  "type": "workflow",
  "workflow": "sub-workflow-name", 
  "description": "What the sub-workflow does"
}
\`\`\`

## Example Workflow

\`\`\`json
{
  "name": "user-registration",
  "description": "Register a new user with validation",
  "expectedOutputs": ["userId", "success", "message"],
  "steps": [
    {
      "type": "prompt",
      "description": "Validate and normalize user input",
      "template": "Validate email {{email}} and name {{fullName}}. Check format and extract firstName/lastName.",
      "expectedOutputs": ["isValid", "email", "firstName", "lastName", "errors"],
      "hints": "Email must be in valid format, names should be trimmed and capitalized"
    },
    {
      "type": "workflow", 
      "workflow": "password-security-check",
      "description": "Validate password strength"
    },
    {
      "type": "mcp",
      "tool": "database-insert",
      "description": "Save user to database",
      "inputMapping": {
        "email": "{{email}}",
        "firstName": "{{firstName}}",
        "lastName": "{{lastName}}",
        "passwordHash": "{{passwordHash}}"
      }
    },
    {
      "type": "prompt",
      "description": "Generate welcome message and final response",
      "template": "Create welcome message for {{firstName}} and format final response with userId {{userId}}",
      "expectedOutputs": ["message", "success"]
    }
  ]
}
\`\`\`

## Key Concepts

1. **Flattening**: Sub-workflows are expanded inline during execution
2. **Data Flow**: Each step receives all previous data and adds new fields
3. **Flexible Prompts**: AI interprets templates and generates appropriate outputs
4. **Template Variables**: Use {{fieldName}} to reference data from previous steps
5. **No Rigid Schemas**: Prompt steps use natural language descriptions instead of strict types
`
                    },
                ],
            };
        }
    );
}