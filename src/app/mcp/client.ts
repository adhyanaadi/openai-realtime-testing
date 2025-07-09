export interface MCPMessage {
  jsonrpc: string;
  method: string;
  params?: Record<string, any>;
}

export function createMCPClient(url: string) {
  let eventSource: EventSource | null = null;
  let messagesEndpoint: string | null = null;
  const handlers: ((data: any) => void)[] = [];

  function connect() {
    if (eventSource) return;
    eventSource = new EventSource(url);
    eventSource.addEventListener('endpoint', (e: MessageEvent) => {
      const data = (e.data || '') as string;
      try {
        const base = new URL(url);
        messagesEndpoint = new URL(data, base).toString();
      } catch {
        messagesEndpoint = null;
      }
    });
    eventSource.addEventListener('message', (e: MessageEvent) => {
      let parsed: any = e.data;
      try {
        parsed = JSON.parse(e.data);
      } catch {}
      handlers.forEach((h) => h(parsed));
    });
  }

  async function send(method: string, params: Record<string, any> = {}) {
    if (!messagesEndpoint) throw new Error('No active transport');
    await fetch(messagesEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params }),
    });
  }

  function onMessage(handler: (data: any) => void) {
    handlers.push(handler);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  async function request(method: string, params: Record<string, any> = {}) {
    connect();
    return new Promise<any>((resolve, reject) => {
      const off = onMessage((data) => {
        off();
        resolve(data);
      });
      send(method, params).catch((err) => {
        off();
        reject(err);
      });
    });
  }

  function close() {
    eventSource?.close();
    eventSource = null;
    messagesEndpoint = null;
  }

  return { connect, send, request, onMessage, close } as const;
}
