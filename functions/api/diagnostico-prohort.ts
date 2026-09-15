// Diagnóstico do PROHORT (preços de frutas e hortaliças nas CEASAs).
//   /api/diagnostico-prohort?produto=banana
//   /api/diagnostico-prohort?produto=tomate&uf=BA

import { buscarHortifruti } from './_prohortPrecos';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const produto = url.searchParams.get('produto') || 'banana';
  const uf = url.searchParams.get('uf') || undefined;

  const r = await buscarHortifruti(produto, uf);

  return new Response(JSON.stringify({
    consulta: { produto, uf: uf || '(todas)' },
    arquivoUsado: r.urlUsada,
    totalEncontrado: r.precos.length,
    amostraDePrecos: r.precos.slice(0, 10),
    amostraDeProdutosNoArquivo: r.produtosDisponiveis,
    aviso: r.aviso,
    diagnosticoPassoAPasso: r.diagnostico,
  }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
