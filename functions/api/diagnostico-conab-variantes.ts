// Lista as variedades de um produto no arquivo da CONAB, com faixa de
// preço de cada uma. Serve pra escolher o nome EXATO em vez de usar um
// padrão aberto que mistura variedades de preços muito diferentes.
//
//   /api/diagnostico-conab-variantes?termo=arroz
//   /api/diagnostico-conab-variantes?termo=arroz,feijao,cafe

import { listarVariantes } from './_conabPrecos';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const termos = (url.searchParams.get('termo') || 'arroz').split(',').map(t => t.trim()).filter(Boolean);

  const resultado = [];
  for (const termo of termos) {
    const r = await listarVariantes(termo);
    resultado.push({ termo, quantasVariedades: r.variantes.length, variedades: r.variantes, diagnostico: r.diagnostico });
  }

  return new Response(JSON.stringify(resultado, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
