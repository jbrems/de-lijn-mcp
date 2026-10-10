import { brusselsDateTime, createDeLijnClient, nextPassages, TIME_ZONE } from './de-lijn.js';

const identifier = description => ({
  type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12, description
});
const stopProperties = {
  entityNumber: identifier('De Lijn entiteitnummer. Obtain this from a municipality stop result.'),
  stopNumber: identifier('De Lijn haltenummer. Keep any leading zeroes.')
};
const definitions = [
  ['list_municipalities', 'List De Lijn municipalities and their identifiers.', {}],
  ['get_municipality_stops', 'Get all stops in a municipality, valid today in Europe/Brussels.', {
    municipalityNumber: identifier('De Lijn gemeentenummer, from list_municipalities; not a postal code.')
  }],
  ['get_stop_lines', 'Get all lines and directions serving a stop today.', stopProperties],
  ['get_stop_next_passages', 'Get the next non-cancelled passage today for every served line and direction. Combine the full timetable with up to 100 realtime passages; timetable fallback is labelled. A null passage means no remaining passage today.', stopProperties],
  ['get_stop_alerts', 'Get detours, disruptions and other messages for a stop today.', stopProperties],
  ['get_stop_passages', 'Get the full timetable of passages at a stop today, including past and cancelled passages and all notes. This is the daily timetable, not just the limited realtime window.', stopProperties],
  ['get_stop_realtime', 'Get the current realtime window for a stop. De Lijn does not accept a date on this endpoint; results may include the next day.', stopProperties]
];

export const tools = definitions.map(([name, description, properties]) => ({
  name, description,
  inputSchema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
}));

export async function callTool(name, args = {}, { get = createDeLijnClient(), now = new Date() } = {}) {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object.');
  for (const key of Object.keys(args)) {
    if (!Object.hasOwn(tool.inputSchema.properties, key)) throw new Error(`Unknown argument: ${key}`);
  }
  for (const key of tool.inputSchema.required) {
    if (typeof args[key] !== 'string' || !/^\d{1,12}$/.test(args[key])) {
      throw new Error(`${key} must be a numeric identifier supplied as a string.`);
    }
  }
  const localNow = brusselsDateTime(now);
  const date = localNow.slice(0, 10);
  const stopPath = `haltes/${args.entityNumber}/${args.stopNumber}`;
  let data;
  const warnings = [];
  switch (name) {
    case 'list_municipalities': data = await get('gemeenten'); break;
    case 'get_municipality_stops':
      data = await get(`gemeenten/${args.municipalityNumber}/haltes`, { geldigOp: localNow }); break;
    case 'get_stop_lines':
      data = await get(`${stopPath}/lijnrichtingen`, { geldigOp: localNow }); break;
    case 'get_stop_next_passages': return nextPassages(get, stopPath, now);
    case 'get_stop_alerts': {
      const names = ['detours', 'messages', 'disruptions'];
      const responses = await Promise.allSettled([
        get(`${stopPath}/omleidingen`, { datum: date }),
        get(`${stopPath}/berichten`, { datum: date }),
        get(`${stopPath}/storingen`, { datum: date })
      ]);
      if (responses.every(r => r.status === 'rejected')) throw responses[0].reason;
      data = Object.fromEntries(responses.map((r, i) => {
        if (r.status === 'fulfilled') return [names[i], r.value];
        warnings.push(`${names[i]}: ${r.reason.message}`);
        return [names[i], null];
      }));
      break;
    }
    case 'get_stop_passages':
      data = await get(`${stopPath}/dienstregelingen`, { datum: date, inclusiefLaatsteDoorkomst: true }); break;
    case 'get_stop_realtime':
      data = await get(`${stopPath}/real-time`, { maxAantalDoorkomsten: 100 }); break;
  }
  return { date, timeZone: TIME_ZONE, fetchedAt: now.toISOString(), data, ...(warnings.length ? { warnings } : {}) };
}
