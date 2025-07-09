import { Tool } from './types';

export const DATA: Record<string, { id: string; title: string; content: string }> = {
  kairos_001: {
    id: 'kairos_001',
    title: 'MCP Scheduler Overview',
    content: 'This explains the scheduling flow of Kairos.',
  },
  kairos_002: {
    id: 'kairos_002',
    title: 'Authentication Flow',
    content: 'Token-based auth using JWT.',
  },
};

export function search(query: string): string[] {
  return Object.entries(DATA)
    .filter(([_, doc]) =>
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase())
    )
    .map(([id]) => id);
}

export function fetch(ids: string[]): any[] {
  return ids.map((id) => DATA[id]).filter(Boolean);
}

export const tools: Tool[] = [
  {
    name: 'search',
    description: 'Search documents by query.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch',
    description: 'Fetch documents by IDs.',
    input_schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['ids'],
    },
  },
];
