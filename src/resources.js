import { readFile } from 'node:fs/promises';

const resourceDefinitions = [
  {
    uri: 'delijn://logos/logo.png',
    name: 'De Lijn logo (PNG)',
    description: 'De Lijn logo in PNG format.',
    mimeType: 'image/png',
    fileUrl: new URL('../public/logo.png', import.meta.url)
  },
  {
    uri: 'delijn://logos/logo.jpg',
    name: 'De Lijn logo (JPEG)',
    description: 'De Lijn logo in JPEG format.',
    mimeType: 'image/jpeg',
    fileUrl: new URL('../public/logo.jpg', import.meta.url)
  }
];

export async function listResources() {
  return Promise.all(resourceDefinitions.map(async ({ fileUrl, ...resource }) => ({
    ...resource,
    size: (await readFile(fileUrl)).byteLength
  })));
}

export async function readResource(uri) {
  const resource = resourceDefinitions.find(candidate => candidate.uri === uri);
  if (!resource) throw new Error(`Unknown resource URI: ${uri}`);

  const data = await readFile(resource.fileUrl);
  return {
    uri: resource.uri,
    mimeType: resource.mimeType,
    blob: data.toString('base64')
  };
}
