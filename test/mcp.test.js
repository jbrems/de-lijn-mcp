import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHandler } from '../api/mcp.js';

test('SDK client initializes, discovers and calls tools over stateless HTTP', async t => {
  const originalToken = process.env.MCP_AUTH_TOKEN;
  process.env.MCP_AUTH_TOKEN = 'test-token';
  t.after(() => {
    if (originalToken === undefined) delete process.env.MCP_AUTH_TOKEN;
    else process.env.MCP_AUTH_TOKEN = originalToken;
  });
  const server = createServer(createHandler({
    get: async () => ({ gemeenten: [{ gemeentenummer: 57, omschrijving: 'Leuven' }] })
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const headers = { Authorization: 'Bearer test-token' };
  assert.equal((await fetch(url, { headers })).status, 405);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 7);
  const result = await client.callTool({ name: 'list_municipalities', arguments: {} });
  assert.equal(result.structuredContent.data.gemeenten[0].gemeentenummer, 57);
  const invalid = await client.callTool({ name: 'get_stop_lines', arguments: {} });
  assert.equal(invalid.isError, true);
});

test('Vercel-style pre-parsed bodies work after the request stream is consumed', async t => {
  const handler = createHandler();
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    req.body = JSON.parse(Buffer.concat(chunks).toString());
    await handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/mcp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vercel-test', version: '1' }
    } })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.serverInfo.name, 'de-lijn-mcp');
});
