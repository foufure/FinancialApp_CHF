import { eodhd } from './lib/eodhd.js';

export default async function handler(request, response) {
  const query = new URL(request.url, 'http://localhost').searchParams.get('q')?.trim();
  if (!query) return response.status(400).json({ error:'Provide a search query with ?q=' });
  try {
    const results = await eodhd('/search', { search_term:query });
    response.status(200).json(results.slice(0, 25));
  } catch (error) {
    response.status(error.message.startsWith('Missing') ? 503 : 502).json({ error:error.message });
  }
}
