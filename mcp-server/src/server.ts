import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import { tools, search, fetch as fetchDocs } from './tools';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/sse', (_req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(`event: tools\ndata: ${JSON.stringify(tools)}\n\n`);
});

app.post('/search', (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Missing 'query'" });
  return res.json({ results: search(query) });
});

app.post('/fetch', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "Missing 'ids' array" });
  return res.json({ documents: fetchDocs(ids) });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`MCP server running on http://localhost:${PORT}`));
