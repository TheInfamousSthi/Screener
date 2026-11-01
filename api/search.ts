const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = (req.query?.q as string) || '';
  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(Array.isArray(data) ? data : []);
    }
    return res.status(200).json([]);
  } catch (err) {
    return res.status(200).json([]);
  }
}
