// Converte coordenadas (latitude/longitude) em nome de cidade/estado,
// usando o Nominatim (OpenStreetMap) — serviço público, gratuito, sem
// necessidade de chave.

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'Faltam parâmetros lat/lon.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR&zoom=10`;
    const res = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'AgroGestao/1.0 (contato via app; uso nao comercial)' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao identificar a localização (status ${res.status}).` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = (await res.json()) as any;
    const addr = data?.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const state = addr.state || '';

    return new Response(JSON.stringify({
      city,
      state,
      label: city && state ? `${city}, ${state}` : (city || state || ''),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Falha ao identificar a localização: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
