import test from 'node:test';
import assert from 'node:assert/strict';
import { brusselsDateTime, passageTime, createDeLijnClient } from '../src/de-lijn.js';
import { callTool } from '../src/tools.js';

const now = new Date('2026-07-01T08:00:00Z');
const stop = { entityNumber: '3', stopNumber: '0306938' };
const line = { entiteitnummer: '3', lijnnummer: 335, richting: 'HEEN' };
const packet = doorkomsten => ({ halteDoorkomsten: [{ doorkomsten }] });
const passage = (id, time, extra = {}) => ({ ...line, doorkomstId: id, dienstregelingTijdstip: time, ...extra });

test('Belgian date and offsetless passage times are independent of host timezone', () => {
  assert.equal(brusselsDateTime(new Date('2026-07-01T22:30:00Z')), '2026-07-02T00:30:00');
  assert.equal(brusselsDateTime(new Date('2026-01-01T23:30:00Z')), '2026-01-02T00:30:00');
  assert.equal(passageTime('2026-07-01T10:00:00'), now.getTime());
  assert.equal(passageTime('2026-01-01T10:00:00'), Date.parse('2026-01-01T09:00:00Z'));
  assert.equal(passageTime('2026-07-01T10:00:00+02:00'), now.getTime());
  assert.equal(passageTime('2026-07-01T10:00:00.500'), now.getTime() + 500);
});

test('all applicable paths use today and full passages are preserved', async () => {
  const requests = [];
  const data = packet([passage('past', '2026-07-01T05:00:00')]);
  const get = async (path, query) => { requests.push({ path, query }); return data; };
  for (const name of ['get_stop_lines', 'get_stop_passages', 'get_stop_alerts']) {
    const result = await callTool(name, stop, { get, now });
    assert.equal(result.date, '2026-07-01');
    if (name === 'get_stop_passages') assert.deepEqual(result.data, data);
  }
  await callTool('get_municipality_stops', { municipalityNumber: '57' }, { get, now });
  assert.deepEqual(requests.map(r => r.path), [
    'haltes/3/0306938/lijnrichtingen', 'haltes/3/0306938/dienstregelingen',
    'haltes/3/0306938/omleidingen', 'haltes/3/0306938/berichten',
    'haltes/3/0306938/storingen', 'gemeenten/57/haltes'
  ]);
  for (const r of requests) {
    assert.equal(r.query.datum ?? r.query.geldigOp, r.path.endsWith('lijnrichtingen') || r.path.startsWith('gemeenten')
      ? '2026-07-01T10:00:00' : '2026-07-01');
  }
  assert.equal(requests[1].query.inclusiefLaatsteDoorkomst, true);
});

test('next passage covers every direction and merges realtime cancellation and delay', async () => {
  const schedule = packet([
    passage('past', '2026-07-01T09:00:00'),
    passage('cancel', '2026-07-01T10:01:00'),
    passage('delayed', '2026-07-01T10:02:00'),
    passage('next', '2026-07-01T10:05:00'),
    passage('tomorrow', '2026-07-02T00:05:00', { richting: 'TERUG' })
  ]);
  const live = packet([
    passage('cancel', '2026-07-01T10:01:00', { status: 'CANCELLED' }),
    passage('delayed', '2026-07-01T10:02:00', { doorkomstTijdstip: '2026-07-01T10:10:00' })
  ]);
  const get = async path => path.endsWith('lijnrichtingen')
    ? { lijnrichtingen: [line, { ...line, richting: 'TERUG' }] }
    : path.endsWith('real-time') ? live : schedule;
  const result = await callTool('get_stop_next_passages', stop, { get, now });
  assert.equal(result.nextPassages[0].passage.doorkomstId, 'next');
  assert.equal(result.nextPassages[0].passage.source, 'timetable');
  assert.equal(result.nextPassages[1].passage, null);
  assert.equal(result.realtimeAvailable, true);
});

test('realtime-only passages work and realtime failures explicitly fall back', async () => {
  const get = async path => {
    if (path.endsWith('lijnrichtingen')) return { lijnrichtingen: [line] };
    if (path.endsWith('real-time')) return packet([passage('live', '2026-07-01T10:03:00')]);
    return packet([]);
  };
  const result = await callTool('get_stop_next_passages', stop, { get, now });
  assert.equal(result.nextPassages[0].passage.source, 'realtime');
  const fallback = await callTool('get_stop_next_passages', stop, {
    now, get: async path => {
      if (path.endsWith('real-time')) throw new Error('Unavailable');
      return get(path);
    }
  });
  assert.equal(fallback.realtimeAvailable, false);
  assert.deepEqual(fallback.warnings, ['Unavailable']);
});

test('key goes in header, requests are uncached, upstream errors do not leak secrets', async () => {
  const get = createDeLijnClient({ apiKey: 'secret', fetchImpl: async (url, options) => {
    assert.equal(url.toString(), 'https://api.delijn.be/DLKernOpenData/api/v1/gemeenten');
    assert.equal(options.headers['Ocp-Apim-Subscription-Key'], 'secret');
    assert.equal(options.cache, 'no-store');
    return new Response('secret upstream body', { status: 401 });
  } });
  await assert.rejects(get('gemeenten'), /HTTP 401/);
  await assert.rejects(createDeLijnClient({ apiKey: '' })('gemeenten'), /DE_LIJN_API_KEY/);
  await assert.rejects(callTool('get_stop_lines', { ...stop, stopNumber: '../foo' }), /numeric identifier/);
  await assert.rejects(callTool('get_stop_lines', { ...stop, date: '2020-01-01' }), /Unknown argument/);
});

test('partial alert failures preserve available messages and explain missing categories', async () => {
  const result = await callTool('get_stop_alerts', stop, { now, get: async path => {
    if (path.endsWith('storingen')) throw new Error('De Lijn HTTP 404.');
    return { berichten: [] };
  } });
  assert.equal(result.data.disruptions, null);
  assert.deepEqual(result.data.messages, { berichten: [] });
  assert.deepEqual(result.warnings, ['disruptions: De Lijn HTTP 404.']);
});
