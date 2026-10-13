const API_BASE = 'https://api.delijn.be/DLKernOpenData/api/v1/';
const TIME_ZONE = 'Europe/Brussels';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function brusselsDateTime(date = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

// De Lijn can return local timestamps without an offset. Interpret those in Belgium,
// not in the UTC timezone used by serverless hosts.
function passageTime(value) {
  if (typeof value !== 'string') return NaN;
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) return Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return NaN;
  const wallTime = Date.parse(`${value}Z`);
  let instant = wallTime;
  for (let i = 0; i < 3; i++) {
    const local = Date.parse(`${brusselsDateTime(new Date(instant))}Z`) + (instant % 1000);
    instant = wallTime - (local - instant);
  }
  return instant;
}

async function request(path, query = {}) {
  const apiKey = process.env.DE_LIJN_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('Set DE_LIJN_API_KEY in .env locally or in Vercel Environment Variables.');
  }
  const url = new URL(path, API_BASE);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'Ocp-Apim-Subscription-Key': apiKey.trim() },
      signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store'
    });
  } catch {
    throw new Error('De Lijn request failed or timed out. Try again later.');
  }
  if (!response.ok) {
    const advice = {
      401: 'Check your DE_LIJN_API_KEY and Core API subscription.',
      403: 'Check that your subscription allows Open Data Core requests.',
      404: 'Check the municipality, entity and stop identifiers.',
      429: 'De Lijn rate limit reached. Try again later.'
    }[response.status] ?? 'De Lijn is unavailable. Try again later.';
    throw new Error(`De Lijn HTTP ${response.status}. ${advice}`);
  }
  try { return await response.json(); }
  catch { throw new Error('De Lijn returned an invalid JSON response.'); }
}

export function listMunicipalities() {
  return request('gemeenten');
}

export function getMunicipalityStops(municipalityNumber) {
  return request(`gemeenten/${municipalityNumber}/haltes`, { geldigOp: brusselsDateTime() });
}

export function getStopLines(entityNumber, stopNumber) {
  return request(`haltes/${entityNumber}/${stopNumber}/lijnrichtingen`, { geldigOp: brusselsDateTime() });
}

export function getStopPassages(entityNumber, stopNumber) {
  return request(`haltes/${entityNumber}/${stopNumber}/dienstregelingen`, {
    datum: brusselsDateTime().slice(0, 10), inclusiefLaatsteDoorkomst: true
  });
}

export function getStopRealtime(entityNumber, stopNumber) {
  return request(`haltes/${entityNumber}/${stopNumber}/real-time`, { maxAantalDoorkomsten: 100 });
}

function getStopDetours(entityNumber, stopNumber) {
  return request(`haltes/${entityNumber}/${stopNumber}/omleidingen`, { datum: brusselsDateTime().slice(0, 10) });
}

function getStopMessages(entityNumber, stopNumber) {
  return request(`haltes/${entityNumber}/${stopNumber}/berichten`, { datum: brusselsDateTime().slice(0, 10) });
}

function getStopDisruptions(entityNumber, stopNumber) {
  return request(`haltes/${entityNumber}/${stopNumber}/storingen`, { datum: brusselsDateTime().slice(0, 10) });
}

export async function getStopAlerts(entityNumber, stopNumber) {
  const [detours, messages, disruptions] = await Promise.allSettled([
    getStopDetours(entityNumber, stopNumber),
    getStopMessages(entityNumber, stopNumber),
    getStopDisruptions(entityNumber, stopNumber)
  ]);
  if ([detours, messages, disruptions].every(result => result.status === 'rejected')) throw detours.reason;
  const warnings = [];
  if (detours.status === 'rejected') warnings.push(`detours: ${detours.reason.message}`);
  if (messages.status === 'rejected') warnings.push(`messages: ${messages.reason.message}`);
  if (disruptions.status === 'rejected') warnings.push(`disruptions: ${disruptions.reason.message}`);
  return {
    detours: detours.status === 'fulfilled' ? detours.value : null,
    messages: messages.status === 'fulfilled' ? messages.value : null,
    disruptions: disruptions.status === 'fulfilled' ? disruptions.value : null,
    ...(warnings.length ? { warnings } : {})
  };
}

export async function getStopNextPassages(entityNumber, stopNumber) {
  const now = new Date();
  const localNow = brusselsDateTime(now);
  const date = localNow.slice(0, 10);
  const [lines, schedule, live] = await Promise.all([
    getStopLines(entityNumber, stopNumber),
    getStopPassages(entityNumber, stopNumber),
    getStopRealtime(entityNumber, stopNumber)
      .then(data => ({ data })).catch(error => ({ error: error.message }))
  ]);
  const merged = new Map(passages(schedule).map(p => [passageKey(p), { ...p, source: 'timetable' }]));
  for (const p of passages(live.data ?? {})) {
    const key = passageKey(p);
    merged.set(key, { ...merged.get(key), ...p, source: 'realtime' });
  }
  const upcoming = [...merged.values()].map(p => ({
    ...p, timestamp: passageTime(p.doorkomstTijdstip ?? p.dienstregelingTijdstip)
  })).filter(p => Number.isFinite(p.timestamp) && p.timestamp >= now.getTime()
    && brusselsDateTime(new Date(p.timestamp)).startsWith(date)
    && p.status !== 'CANCELLED').sort((a, b) => a.timestamp - b.timestamp);
  return {
    realtimeAvailable: !live.error,
    warnings: live.error ? [live.error] : [],
    nextPassages: (lines.lijnrichtingen ?? []).map(line => {
      const next = upcoming.find(p => directionKey(p) === directionKey(line));
      if (!next) return { line, passage: null };
      const { timestamp, ...passage } = next;
      return { line, passage };
    }),
    notes: {
      timetable: {
        ritNotas: schedule.ritNotas ?? [], doorkomstNotas: schedule.doorkomstNotas ?? [],
        dienstregelingNotas: schedule.dienstregelingNotas ?? []
      },
      realtime: {
        ritNotas: live.data?.ritNotas ?? [], doorkomstNotas: live.data?.doorkomstNotas ?? [],
        dienstregelingNotas: live.data?.dienstregelingNotas ?? []
      }
    }
  };
}

function passages(data) {
  return (data.halteDoorkomsten ?? []).flatMap(stop => stop.doorkomsten ?? []);
}

function directionKey(line) {
  return `${line.entiteitnummer}:${line.lijnnummer}:${line.richting}`;
}

function passageKey(passage) {
  return passage.doorkomstId
    ?? `${directionKey(passage)}:${passage.ritnummer}:${passage.dienstregelingTijdstip}`;
}
