import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { searchKnowledgeBase } from './agent.ts';

const server = new McpServer({
  name: 'dehydrated-reader-knowledge',
  version: '0.1.0',
});

server.registerTool(
  'search_knowledge',
  {
    title: 'Search Dehydrated Reader knowledge base',
    description: 'Search the local Dehydrated Reader SQLite + vector RAG knowledge base.',
    inputSchema: {
      query: z.string().min(1).describe('Search question, concept, tag, source, or keyword.'),
      limit: z.number().int().min(1).max(20).optional().describe('Maximum result count. Defaults to 8.'),
    },
  },
  async ({ query, limit }) => {
    const result = await searchKnowledgeBase(query, limit ?? 8);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Dehydrated Reader knowledge MCP running on stdio');
}

main().catch((error) => {
  console.error('Knowledge MCP failed:', error);
  process.exit(1);
});
