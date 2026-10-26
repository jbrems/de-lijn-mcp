import * as deLijnService from './de-lijn.js';

function stopOutputSchema(payloadName) {
  return {
    type: 'object',
    properties: {
      stops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            stopId: {
              type: 'object',
              properties: { entityNumber: { type: 'string' }, stopNumber: { type: 'string' } },
              required: ['entityNumber', 'stopNumber'], additionalProperties: false
            },
            // Keep upstream JSON intact, including arrays and fields added by De Lijn.
            [payloadName]: {}
          },
          required: ['stopId', payloadName], additionalProperties: false
        }
      }
    },
    required: ['stops'], additionalProperties: false
  };
}

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
  outputSchema: stopOutputSchema('lines'),
  description: 'Get all lines and directions serving one or more stops today.',
  inputSchema: {
    type: 'object',
    properties: {
      stopIds: {
        type: 'array', minItems: 1, maxItems: 50,
        description: 'De Lijn stop identifiers. Obtain these from municipality stop results.',
        items: {
          type: 'object',
          properties: {
            entityNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn entiteitnummer.'
            },
            stopNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn haltenummer. Keep any leading zeroes.'
            }
          },
          required: ['entityNumber', 'stopNumber'], additionalProperties: false
        }
      }
    },
    required: ['stopIds'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopNextPassagesTool = {
  name: 'get_stop_next_passages',
  outputSchema: stopOutputSchema('nextPassages'),
  description: 'Get the next non-cancelled passage today for every served line and direction at one or more stops. Combine the full timetable with up to 100 realtime passages per stop; timetable fallback is labelled. A null passage means no remaining passage today.',
  inputSchema: {
    type: 'object',
    properties: {
      stopIds: {
        type: 'array', minItems: 1, maxItems: 50,
        description: 'De Lijn stop identifiers. Obtain these from municipality stop results.',
        items: {
          type: 'object',
          properties: {
            entityNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn entiteitnummer.'
            },
            stopNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn haltenummer. Keep any leading zeroes.'
            }
          },
          required: ['entityNumber', 'stopNumber'], additionalProperties: false
        }
      }
    },
    required: ['stopIds'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopAlertsTool = {
  name: 'get_stop_alerts',
  outputSchema: stopOutputSchema('alerts'),
  description: 'Get detours, disruptions and other messages for one or more stops today.',
  inputSchema: {
    type: 'object',
    properties: {
      stopIds: {
        type: 'array', minItems: 1, maxItems: 50,
        description: 'De Lijn stop identifiers. Obtain these from municipality stop results.',
        items: {
          type: 'object',
          properties: {
            entityNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn entiteitnummer.'
            },
            stopNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn haltenummer. Keep any leading zeroes.'
            }
          },
          required: ['entityNumber', 'stopNumber'], additionalProperties: false
        }
      }
    },
    required: ['stopIds'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopPassagesTool = {
  name: 'get_stop_passages',
  outputSchema: stopOutputSchema('passages'),
  description: 'Get the full timetable of passages at one or more stops today, including past and cancelled passages and all notes. This is the daily timetable, not just the limited realtime window.',
  inputSchema: {
    type: 'object',
    properties: {
      stopIds: {
        type: 'array', minItems: 1, maxItems: 50,
        description: 'De Lijn stop identifiers. Obtain these from municipality stop results.',
        items: {
          type: 'object',
          properties: {
            entityNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn entiteitnummer.'
            },
            stopNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn haltenummer. Keep any leading zeroes.'
            }
          },
          required: ['entityNumber', 'stopNumber'], additionalProperties: false
        }
      }
    },
    required: ['stopIds'], additionalProperties: false
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export const getStopRealtimeTool = {
  name: 'get_stop_realtime',
  outputSchema: stopOutputSchema('realtime'),
  description: 'Get the current realtime window for one or more stops. De Lijn does not accept a date on this endpoint; results may include the next day.',
  inputSchema: {
    type: 'object',
    properties: {
      stopIds: {
        type: 'array', minItems: 1, maxItems: 50,
        description: 'De Lijn stop identifiers. Obtain these from municipality stop results.',
        items: {
          type: 'object',
          properties: {
            entityNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn entiteitnummer.'
            },
            stopNumber: {
              type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 12,
              description: 'De Lijn haltenummer. Keep any leading zeroes.'
            }
          },
          required: ['entityNumber', 'stopNumber'], additionalProperties: false
        }
      }
    },
    required: ['stopIds'], additionalProperties: false
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

export async function getStopLines(args) {
  return { stops: await Promise.all(args.stopIds.map(async stopId => ({
    stopId,
    lines: await deLijnService.getStopLines(stopId.entityNumber, stopId.stopNumber)
  }))) };
}

export async function getStopNextPassages(args) {
  return { stops: await Promise.all(args.stopIds.map(async stopId => ({
    stopId,
    nextPassages: await deLijnService.getStopNextPassages(stopId.entityNumber, stopId.stopNumber)
  }))) };
}

export async function getStopAlerts(args) {
  return { stops: await Promise.all(args.stopIds.map(async stopId => ({
    stopId,
    alerts: await deLijnService.getStopAlerts(stopId.entityNumber, stopId.stopNumber)
  }))) };
}

export async function getStopPassages(args) {
  return { stops: await Promise.all(args.stopIds.map(async stopId => ({
    stopId,
    passages: await deLijnService.getStopPassages(stopId.entityNumber, stopId.stopNumber)
  }))) };
}

export async function getStopRealtime(args) {
  return { stops: await Promise.all(args.stopIds.map(async stopId => ({
    stopId,
    realtime: await deLijnService.getStopRealtime(stopId.entityNumber, stopId.stopNumber)
  }))) };
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
