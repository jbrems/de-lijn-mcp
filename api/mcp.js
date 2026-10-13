import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../src/mcp.js';

function reply(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

export function createHandler() {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (origin && !allowedOrigins.includes(origin)) return reply(res, 403, 'Origin not allowed.');
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, MCP-Protocol-Version');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const token = process.env.MCP_AUTH_TOKEN;
    if (token) {
      const actual = Buffer.from(req.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${token}`);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        return reply(res, 401, 'A valid MCP bearer token is required.');
      }
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return reply(res, 405, 'Use MCP Streamable HTTP POST requests; no persistent SSE stream is provided.');
    }
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true
    });
    res.on('close', () => { void server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) reply(res, 500, 'MCP request failed.');
      else if (!res.writableEnded) res.end();
    }
  };
}

export default createHandler();
