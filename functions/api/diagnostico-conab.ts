// Diagnóstico da integração com a CONAB (série histórica de preços POR
// ESTADO). Acesse:
//   /api/diagnostico-conab?produto=boi_gordo&estado=Bahia
//
// Mostra qual endereço candidato respondeu, o separador e as colunas
// detectadas no arquivo, quantas linhas casaram com o produto, quantas
// com a UF, e quantos pontos sobraram no período. Serve pra descobrir o
// endereço correto do arquivo sem ficar chutando no escuro.

import { buscarHistoricoConab } from './_conabPrecos';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const produto = url.searchParams.get('produto') || 'boi_gordo';
  const estado = url.searchParams.get('estado') || 'Bahia';
  const inicio = url.searchParams.get('inicio') || '2025-01-01';
  const fim = url.searchParams.get('fim') || new Date().toISOString().slice(0, 10);

  const r = await buscarHistoricoConab(produto, estado, inicio, fim);

  return new Response(JSON.stringify({
    consulta: { produto, estado, inicio, fim },
    arquivoUsado: r.urlUsada,
    produtoEncontradoNoArquivo: r.produtoEncontrado,
    unidade: r.unidade,
    totalPontos: r.pontos.length,
    primeirosPontos: r.pontos.slice(0, 5),
    ultimosPontos: r.pontos.slice(-5),
    aviso: r.aviso,
    produtosParecidos: r.produtosParecidos,
    amostraDeProdutosNoArquivo: r.produtosNoArquivo,
    diagnosticoPassoAPasso: r.diagnostico,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
