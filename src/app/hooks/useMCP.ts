'use client';
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:8000';

export default function useMCP() {
  const [results, setResults] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const search = async (query: string) => {
    const res = await fetch(`${BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setResults(data.results || []);
  };

  const fetchDocs = async (ids: string[]) => {
    const res = await fetch(`${BASE}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    setDocuments(data.documents || []);
  };

  return { search, fetchDocs, results, documents } as const;
}
