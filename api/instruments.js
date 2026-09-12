import { curatedUniverse, getInstrumentHistory, normalizeInstrument } from './lib/eodhd.js';

export default async function handler(request, response) {
  try {
    const results = await Promise.allSettled(curatedUniverse.map(async (meta) => normalizeInstrument(meta, await getInstrumentHistory(meta))));
    const instruments = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const warnings = results.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
    if (instruments.length === 0) throw new Error('EODHD returned no usable instruments.');
    response.status(200).json({ instruments, warnings });
  } catch (error) {
    response.status(error.message.startsWith('Missing') ? 503 : 502).json({ error:error.message });
  }
}
