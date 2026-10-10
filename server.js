import { createServer } from 'node:http';
import handler from './api/mcp.js';

const port = Number(process.env.PORT || 3000);
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/mcp' || path === '/api/mcp') return void handler(req, res);
  res.writeHead(path === '/health' ? 200 : 404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(path === '/health' ? { status: 'ok' } : { error: 'Not found. MCP endpoint: /mcp' }));
});
server.listen(port, '127.0.0.1', () => console.log(`De Lijn MCP: http://127.0.0.1:${port}/mcp`));
