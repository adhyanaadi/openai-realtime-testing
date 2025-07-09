'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createMCPClient } from '../mcp/client';

export default function useMCPClient() {
  const clientRef = useRef<ReturnType<typeof createMCPClient> | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_MCP_SSE;
    if (!url) return;
    const client = createMCPClient(url);
    clientRef.current = client;
    client.onMessage((d) => setMessages((prev) => [...prev, d]));
    client.connect();
    return () => client.close();
  }, []);

  const sendCommand = useCallback(async (method: string, params: Record<string, any> = {}) => {
    if (!clientRef.current) throw new Error('Client not initialized');
    await clientRef.current.send(method, params);
  }, []);

  return { sendCommand, messages } as const;
}
