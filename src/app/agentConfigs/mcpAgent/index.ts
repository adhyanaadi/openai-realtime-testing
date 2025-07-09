import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { createMCPClient } from '../../mcp/client';

const MCP_URL = process.env.NEXT_PUBLIC_MCP_SSE || '';
const client = createMCPClient(MCP_URL);

const runMCPCommand = tool({
  name: 'runMCPCommand',
  description: 'Execute a MongoDB command via the MCP server.',
  parameters: {
    type: 'object',
    properties: {
      method: { type: 'string', description: 'Command name' },
      params: { type: 'object', description: 'Optional parameters for the command' },
    },
    required: ['method'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { method, params = {} } = input as { method: string; params?: Record<string, any> };
    if (!MCP_URL) return { error: 'MCP server not configured' };
    const result = await client.request(method, params);
    return result;
  },
});

export const mcpAgent = new RealtimeAgent({
  name: 'mcpAgent',
  voice: 'echo',
  instructions:
    'You are a MongoDB assistant. Use the runMCPCommand tool to fetch information and summarize the results succinctly for the user.',
  tools: [runMCPCommand],
  handoffs: [],
  handoffDescription: 'Agent that queries a MongoDB database',
});

export const mcpScenario = [mcpAgent];
