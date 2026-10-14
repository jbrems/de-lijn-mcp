# De Lijn MCP

A small Node.js MCP server backed by the [De Lijn Open Data Core v1 API](https://portal.delijn.be/api-details#api=KernOpenDataServicesV1).
One direct runtime dependency: the official MCP SDK. HTTP, fetch and environment loading use Node's built-in modules.

## Local Setup

Use Node.js 22. The project already contains an ignored `.env` file. Add your Core API subscription key:

```dotenv
DE_LIJN_API_KEY=your-subscription-key
```

Then run from this directory:

```sh
npm install
npm start
```

The MCP URL is `http://127.0.0.1:3000/mcp`. Change `PORT` in `.env` if necessary.
The local health check is `http://127.0.0.1:3000/health` (it checks the server, not the De Lijn key).
Environment variables already set in your shell take precedence over `.env`.
For a fresh checkout, create `.env` from `.env.example`.

## Tools

| Tool | Arguments | Core API source |
| --- | --- | --- |
| `list_municipalities` | none | `/gemeenten` |
| `get_municipality_stops` | `municipalityNumber` | `/gemeenten/{gemeenteNummer}/haltes` |
| `get_stop_lines` | `stopIds` (array of `entityNumber`, `stopNumber` pairs) | `/haltes/{entiteitnummer}/{haltenummer}/lijnrichtingen` |
| `get_stop_next_passages` | `entityNumber`, `stopNumber` | Line directions + daily timetable + realtime |
| `get_stop_alerts` | `entityNumber`, `stopNumber` | Stop `/omleidingen`, `/berichten`, `/storingen` |
| `get_stop_passages` | `entityNumber`, `stopNumber` | Stop `/dienstregelingen` |
| `get_stop_realtime` | `entityNumber`, `stopNumber` | Stop `/real-time` |

Supply identifiers as strings, for example `{"entityNumber":"3","stopNumber":"306938"}`.
Municipality numbers are De Lijn identifiers, not postal codes. Find them using `list_municipalities`.
Municipality stop results include the entity and stop numbers needed by the other tools.
They also include `coordinates.latitude` and `coordinates.longitude`, so callers can display the stops on a map.

`get_stop_lines` accepts up to 50 stops in one call, for example:

```json
{"stopIds":[{"entityNumber":"3","stopNumber":"306938"},{"entityNumber":"3","stopNumber":"306939"}]}
```

Its response is an array that pairs each requested `stopId` with its `lines` response.

All applicable requests explicitly use the current Belgian date/time (`Europe/Brussels`), including daylight saving time.
No tool accepts a historical or future date. `geldigOp` is sent as a local date/time; `datum` as a local calendar date.
Responses return the useful De Lijn payload directly without a metadata envelope.
If only some alert endpoints fail, successful alerts are returned and failed categories are `null` with explicit warnings.
There is no data cache. The subscription key is sent in `Ocp-Apim-Subscription-Key`, never in the URL.

`get_stop_passages` returns the complete daily timetable, including earlier and cancelled passages and notes.
`get_stop_next_passages` returns one entry per served line **and direction**. Realtime updates override matching timetable passages;
cancelled, past and next-calendar-day passages are excluded. `passage: null` means no remaining eligible passage today.
Each passage has a `source` of `realtime` or `timetable`. The realtime request is limited to 100 passages, so distant departures
may only have timetable information. If realtime fails, timetable results are returned with `realtimeAvailable: false` and a warning.
The standalone realtime tool returns the API's current window unchanged; that endpoint has no date parameter and can span midnight.

## Resources

The server exposes both De Lijn logo files as binary MCP resources:

| Resource URI | MIME type |
| --- | --- |
| `delijn://logos/logo.png` | `image/png` |
| `delijn://logos/logo.jpg` | `image/jpeg` |

Use `resources/list` to discover them and `resources/read` to retrieve their base64-encoded image data.

## Prompts

| Prompt | Argument | Result |
| --- | --- | --- |
| `fetch_stops_in_municipality` | `municipality` (required) | Asks for all bus stops in the named municipality and the lines serving them. |
| `fetch_next_3_passages_at_stops` | `stopNames` (required, comma-separated) | Asks for the next three passages at the named stops. |

## Vercel

1. Import this directory's repository into Vercel, or run `npx vercel` here. Select the **Other** framework preset; no build command or output directory is needed.
2. Add `DE_LIJN_API_KEY` under **Project Settings > Environment Variables** for the deployment environments you use.
3. Optionally add `MCP_AUTH_TOKEN` and configure clients to send `Authorization: Bearer <token>`.
4. Deploy or redeploy after changing variables. Connect your MCP client to `https://your-project.vercel.app/mcp`.

`api/mcp.js` is a Node.js Vercel Function; `vercel.json` rewrites `/mcp` to it and allows up to 60 seconds per invocation.
The endpoint uses stateless [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
with JSON responses. It does not require sticky sessions or a persistent SSE connection. GET/DELETE return 405 as permitted by the protocol.
Use a client with Streamable HTTP support; the old standalone `/sse` transport is not implemented.
Vercel deployment protection, when enabled, must also allow your MCP client access.

The server is accessible without authentication unless `MCP_AUTH_TOKEN` is set. This token is separate from the De Lijn API key.
Requests without an Origin header (normal desktop/server clients) are accepted. For browser clients, add exact origins to
`MCP_ALLOWED_ORIGINS`, separated by commas, for example `https://client.example.com`. Other browser origins are rejected.
