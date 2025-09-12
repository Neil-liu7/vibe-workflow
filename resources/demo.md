# Workflow Demo

I want to create a workflow named 'workflow-demo'. It contains 3 steps, first take a input keyword and generates 5 related querys, then use the tool web-search to fetch contents base on the query, then summerize the contents into simplified words to describe the concept of the keyword

## Workflow Definition

```json
{
  "name": "workflow-demo",
  "desc": "A demonstration workflow that takes a keyword, generates related queries, searches the web, and summarizes the results",
  "inputs": {
    "keyword": "string"
  },
  "outputs": {
    "summary": "string"
  },
  "steps": [
    {
      "type": "prompt",
      "template": "Given the keyword '{{keyword}}', generate 5 related search queries that would help understand this concept better. Return the queries as a JSON array of strings in the format: {\"queries\": [\"query1\", \"query2\", \"query3\", \"query4\", \"query5\"]}",
      "inputs": {
        "keyword": "string"
      },
      "outputs": {
        "queries": "array"
      }
    },
    {
      "type": "mcp",
      "tool": "web_search",
      "inputs": {
        "queries": "array"
      },
      "outputs": {
        "search_results": "array"
      }
    },
    {
      "type": "prompt",
      "template": "Based on the following search results about '{{keyword}}', create a simplified summary that explains the concept in easy-to-understand words. Search results: {{search_results}}. Please provide a concise summary that captures the key aspects of this concept.",
      "inputs": {
        "keyword": "string",
        "search_results": "array"
      },
      "outputs": {
        "summary": "string"
      }
    }
  ]
}
```

## Usage Example

1. **Save the workflow**:
   ```
   Use MCP tool: workflow_save
   Parameters: {
     "workflow_definition": <the JSON above>,
     "filename": "workflow-demo"
   }
   ```

2. **Run the workflow**:
   ```
   Use MCP tool: workflow_run
   Parameters: {
     "workflow_name": "workflow-demo",
     "inputs": {
       "keyword": "artificial intelligence"
     }
   }
   ```

## Expected Flow

1. **Step 1 (Query Generation)**: Takes input keyword "artificial intelligence" and generates 5 related search queries
2. **Step 2 (Web Search)**: Uses the generated queries to search the web and collect relevant information
3. **Step 3 (Summarization)**: Analyzes the search results and creates a simplified summary explaining the concept

## Output

The workflow will return a comprehensive yet simplified explanation of the input keyword based on current web information, making complex concepts accessible to general audiences.