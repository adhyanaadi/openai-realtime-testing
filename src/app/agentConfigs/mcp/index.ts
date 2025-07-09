import { RealtimeAgent, tool } from '@openai/agents/realtime';

const BASE = process.env.NEXT_PUBLIC_MCP_URL || '';

const searchTool = tool({
  name: 'search',
  description: 'Search documents by query.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  execute: async (input: any) => {
    if (!BASE) return [];
    const res = await fetch(`${BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input.query }),
    });
    const data = await res.json();
    return data.results;
  },
});

const fetchTool = tool({
  name: 'fetch',
  description: 'Fetch documents by IDs.',
  parameters: {
    type: 'object',
    properties: { ids: { type: 'array', items: { type: 'string' } } },
    required: ['ids'],
  },
  execute: async (input: any) => {
    if (!BASE) return [];
    const res = await fetch(`${BASE}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: input.ids }),
    });
    const data = await res.json();
    return data.documents;
  },
});

export const mcpAgent = new RealtimeAgent({
  name: 'mcpAgent',
  voice: 'echo',
  instructions: 'Use the search and fetch tools to retrieve MCP documents.',
  tools: [searchTool, fetchTool],
  handoffs: [],
  handoffDescription: 'Agent that queries MCP documents',
});

export const mcpScenario = [mcpAgent];
