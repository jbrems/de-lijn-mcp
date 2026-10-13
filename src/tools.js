import * as deLijnService from './de-lijn.js';

export const listMunicipalitiesTool = {
  name: 'list_municipalities',
  description: 'List De Lijn municipalities and their identifiers.',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getMunicipalityStopsTool = {
  name: 'get_municipality_stops',
  description: 'Get all stops in a municipality. Each stop includes latitude and longitude coordinates and can be displayed on a map.',
  inputSchema: {
    type: 'object',
    properties: {
      municipalityNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn gemeentenummer, from list_municipalities; not a postal code.'
      }
    },
    required: ['municipalityNumber'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopLinesTool = {
  name: 'get_stop_lines',
  description: 'Get all lines and directions serving a stop today.',
  inputSchema: {
    type: 'object',
    properties: {
      entityNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn entiteitnummer. Obtain this from a municipality stop result.'
      },
      stopNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn haltenummer. Keep any leading zeroes.'
      }
    },
    required: ['entityNumber', 'stopNumber'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopNextPassagesTool = {
  name: 'get_stop_next_passages',
  description: 'Get the next non-cancelled passage today for every served line and direction. Combine the full timetable with up to 100 realtime passages; timetable fallback is labelled. A null passage means no remaining passage today.',
  inputSchema: {
    type: 'object',
    properties: {
      entityNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn entiteitnummer. Obtain this from a municipality stop result.'
      },
      stopNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn haltenummer. Keep any leading zeroes.'
      }
    },
    required: ['entityNumber', 'stopNumber'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopAlertsTool = {
  name: 'get_stop_alerts',
  description: 'Get detours, disruptions and other messages for a stop today.',
  inputSchema: {
    type: 'object',
    properties: {
      entityNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn entiteitnummer. Obtain this from a municipality stop result.'
      },
      stopNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn haltenummer. Keep any leading zeroes.'
      }
    },
    required: ['entityNumber', 'stopNumber'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopPassagesTool = {
  name: 'get_stop_passages',
  description: 'Get the full timetable of passages at a stop today, including past and cancelled passages and all notes. This is the daily timetable, not just the limited realtime window.',
  inputSchema: {
    type: 'object',
    properties: {
      entityNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn entiteitnummer. Obtain this from a municipality stop result.'
      },
      stopNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn haltenummer. Keep any leading zeroes.'
      }
    },
    required: ['entityNumber', 'stopNumber'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopRealtimeTool = {
  name: 'get_stop_realtime',
  description: 'Get the current realtime window for a stop. De Lijn does not accept a date on this endpoint; results may include the next day.',
  inputSchema: {
    type: 'object',
    properties: {
      entityNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn entiteitnummer. Obtain this from a municipality stop result.'
      },
      stopNumber: {
        type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
        description: 'De Lijn haltenummer. Keep any leading zeroes.'
      }
    },
    required: ['entityNumber', 'stopNumber'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const tools = [
  listMunicipalitiesTool, getMunicipalityStopsTool, getStopLinesTool, getStopNextPassagesTool,
  getStopAlertsTool, getStopPassagesTool, getStopRealtimeTool
];

export function listMunicipalities() {
  return deLijnService.listMunicipalities();
}

export async function getMunicipalityStops(args) {
  const response = await deLijnService.getMunicipalityStops(args.municipalityNumber);
  return {
    ...response,
    haltes: (response.haltes ?? []).map(stop => ({
      ...stop,
      coordinates: {
        latitude: stop.geoCoordinaat?.latitude ?? null,
        longitude: stop.geoCoordinaat?.longitude ?? null
      }
    }))
  };
}

export function getStopLines(args) {
  return deLijnService.getStopLines(args.entityNumber, args.stopNumber);
}

export function getStopNextPassages(args) {
  return deLijnService.getStopNextPassages(args.entityNumber, args.stopNumber);
}

export function getStopAlerts(args) {
  return deLijnService.getStopAlerts(args.entityNumber, args.stopNumber);
}

export function getStopPassages(args) {
  return deLijnService.getStopPassages(args.entityNumber, args.stopNumber);
}

export function getStopRealtime(args) {
  return deLijnService.getStopRealtime(args.entityNumber, args.stopNumber);
}

export async function callTool(name, args = {}) {
  switch (name) {
    case 'list_municipalities': return listMunicipalities(args);
    case 'get_municipality_stops': return getMunicipalityStops(args);
    case 'get_stop_lines': return getStopLines(args);
    case 'get_stop_next_passages': return getStopNextPassages(args);
    case 'get_stop_alerts': return getStopAlerts(args);
    case 'get_stop_passages': return getStopPassages(args);
    case 'get_stop_realtime': return getStopRealtime(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
