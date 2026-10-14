import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getPrompt, prompts } from './prompts.js';
import { listResources, readResource } from './resources.js';
import { callTool, tools } from './tools.js';

export function createMcpServer() {
  const server = new Server(
    { name: 'de-lijn-mcp', version: '1.2.0' },
    { capabilities: { prompts: {}, resources: {}, tools: {} } }
  );
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));
  server.setRequestHandler(GetPromptRequestSchema, async request => (
    getPrompt(request.params.name, request.params.arguments)
  ));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: await listResources() }));
  server.setRequestHandler(ReadResourceRequestSchema, async request => ({
    contents: [await readResource(request.params.uri)]
  }));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const result = await callTool(request.params.name, request.params.arguments);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  });
  return server;
}
