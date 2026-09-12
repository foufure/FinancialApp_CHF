import { curatedUniverse, getInstrumentHistory, normalizeInstrument } from './lib/eodhd.js';

export default async function handler(request, response) {
  try {
    const instruments = await Promise.all(curatedUniverse.map(async (meta) => normalizeInstrument(meta, await getInstrumentHistory(meta))));
    response.status(200).json(instruments);
  } catch (error) {
    response.status(error.message.startsWith('Missing') ? 503 : 502).json({ error:error.message });
  }
}
