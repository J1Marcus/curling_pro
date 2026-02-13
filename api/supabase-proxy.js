// Vercel serverless function that proxies requests to Supabase
// Used by the admin dashboard to bypass browser cross-origin issues
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, method, headers, body } = req.body;

  if (!url || !url.includes('supabase.co')) {
    return res.status(400).json({ error: 'Invalid Supabase URL' });
  }

  try {
    const fetchOptions = {
      method: method || 'GET',
      headers: headers || {}
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    // Forward relevant headers
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Forward content-range for count queries
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      res.setHeader('x-content-range', contentRange);
    }

    return res.status(response.status).send(responseText);
  } catch (err) {
    return res.status(502).json({ error: 'Proxy error: ' + err.message });
  }
}
