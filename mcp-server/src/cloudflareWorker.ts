import OpenAI from "openai";

interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
}

interface RegisteredServer {
  tools: Tool[];
}

const servers: Record<string, RegisteredServer> = {};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface Env {
  OPENAI_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/servers") {
      const body = (await request.json()) as RegisteredServer;
      const id = crypto.randomUUID();
      servers[id] = body;
      return json({
        id,
        config: `/${id}/.well-known/openai-mcp.json`,
        call: `/${id}/call`,
      });
    }

    const configMatch = path.match(/^\/(.+?)\/\.well-known\/openai-mcp\.json$/);
    if (configMatch) {
      const server = servers[configMatch[1]];
      if (!server) return json({ error: "not found" }, 404);
      return json({ mcp: { version: "1.0.0", tools: server.tools } });
    }

    const callMatch = path.match(/^\/(.+?)\/call$/);
    if (request.method === "POST" && callMatch) {
      const server = servers[callMatch[1]];
      if (!server) return json({ error: "not found" }, 404);
      const { tool, input } = (await request.json()) as {
        tool: string;
        input: any;
      };
      if (tool === "echo") {
        return json({ result: input?.text ?? "" });
      }
      if (tool === "openai-complete") {
        const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: input.prompt },
          ],
        });
        return json({ result: completion.choices[0]?.message?.content });
      }
      return json({ error: "tool not implemented" }, 400);
    }

    return json({ error: "not found" }, 404);
  },
};
