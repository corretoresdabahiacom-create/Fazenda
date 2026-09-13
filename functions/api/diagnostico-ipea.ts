// Diagnóstico da integração com o IPEADATA (série histórica de preço).
// Acesse: /api/diagnostico-ipea?produto=boi_gordo&inicio=2025-01-01&fim=2026-09-13
//
// Mostra passo a passo o que aconteceu: qual host respondeu, quantas
// séries o catálogo devolveu, quantas passaram em cada validação, qual
// foi escolhida, e qual o período que ela realmente cobre. Serve pra
// diagnosticar por que o gráfico ficou sem preço, sem precisar
// adivinhar.

import { buscarHistoricoIpea } from './_ipeaHistorico';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const produto = url.searchParams.get('produto') || 'boi_gordo';
  const inicio = url.searchParams.get('inicio') || '2025-01-01';
  const fim = url.searchParams.get('fim') || new Date().toISOString().slice(0, 10);

  const resultado = await buscarHistoricoIpea(produto, inicio, fim);

  return new Response(JSON.stringify({
    produtoConsultado: produto,
    periodoConsultado: { inicio, fim },
    serieEncontrada: resultado.serie,
    totalPontosNoPeriodo: resultado.pontos.length,
    primeirosPontos: resultado.pontos.slice(0, 5),
    ultimosPontos: resultado.pontos.slice(-5),
    aviso: resultado.aviso,
    diagnosticoPassoAPasso: resultado.diagnostico,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
