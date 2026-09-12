import { curatedUniverse, dedupeUniverse, discoverUniverse, filterDiscoveredUniverse, getInstrumentHistory, normalizeInstrument, paginateUniverse } from './lib/eodhd.js';

export default async function handler(request, response) {
  try {
    const params = new URL(request.url, 'http://localhost').searchParams;
    const importing = params.get('import') !== '0';
    const filters = {
      type: params.get('type') ?? 'all',
      market: params.get('market') ?? 'all',
      chfOnly: params.get('chf') === '1',
      hedgedOnly: params.get('hedged') === '1'
    };
    let universe = curatedUniverse;
    const warnings = [];
    if (importing) {
      const discovery = await discoverUniverse({
        exchanges: (params.get('exchanges') ?? 'SW,XETRA,LSE,NASDAQ').split(',').filter(Boolean).slice(0, 6),
        query: params.get('q')?.trim(),
        limit: 500
      });
      warnings.push(...discovery.warnings);
      const imported = paginateUniverse(filterDiscoveredUniverse(discovery.items, filters), params.get('page'), params.get('limit'));
      universe = dedupeUniverse([...curatedUniverse, ...imported]);
    }
    const results = await Promise.allSettled(universe.map(async (meta) => normalizeInstrument(meta, await getInstrumentHistory(meta))));
    const instruments = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    warnings.push(...results.filter((result) => result.status === 'rejected').map((result) => result.reason.message));
    if (instruments.length === 0) throw new Error('EODHD returned no usable instruments.');
    response.status(200).json({ instruments, warnings, imported: Math.max(0, instruments.length - curatedUniverse.length), total: instruments.length });
  } catch (error) {
    response.status(error.message.startsWith('Missing') ? 503 : 502).json({ error:error.message });
  }
}
