// api/proxy.js
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response(JSON.stringify({ error: 'url required' }), { status: 400 });

  try {
    const response = await fetch(decodeURIComponent(url));
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
