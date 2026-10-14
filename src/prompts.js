export const prompts = [
  {
    name: 'fetch_stops_in_municipality',
    title: 'Fetch stops in municipality',
    description: 'Ask for every bus stop in a municipality and the lines serving each stop.',
    arguments: [
      {
        name: 'municipality',
        description: 'The municipality name, for example Antwerpen or Gent.',
        required: true
      }
    ]
  },
  {
    name: 'fetch_next_3_passages_at_stops',
    title: 'Fetch the next 3 passages at stops',
    description: 'Ask for the next three passages at a list of named stops.',
    arguments: [
      {
        name: 'stopNames',
        description: 'A comma-separated list of stop names.',
        required: true
      }
    ]
  }
];

export function getPrompt(name, args = {}) {
  let text;

  if (name === 'fetch_stops_in_municipality') {
    const municipality = args.municipality?.trim();
    if (!municipality) throw new Error('The municipality argument is required.');
    text = `Geef mij alle bushaltes in ${municipality} en de lijnen die de haltes bedienen`;
  } else if (name === 'fetch_next_3_passages_at_stops') {
    const stopNames = args.stopNames?.trim();
    if (!stopNames) throw new Error('The stopNames argument is required.');
    text = `Geef mij de 3 eerstvolgende doorkomsten aan de haltes ${stopNames}.`;
  } else {
    throw new Error(`Unknown prompt: ${name}`);
  }

  return {
    description: prompts.find(prompt => prompt.name === name).description,
    messages: [{ role: 'user', content: { type: 'text', text } }]
  };
}
