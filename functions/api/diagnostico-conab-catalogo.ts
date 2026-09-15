// Catálogo completo do arquivo da CONAB. Devolve TODOS os produtos com
// cobertura por estado, faixa de preço e níveis de comercialização —
// o que é necessário pra expandir a lista de produtos usando os nomes
// REAIS, em vez de adivinhar.
//
//   /api/diagnostico-conab-catalogo                     -> tudo
//   /api/diagnostico-conab-catalogo?minEstados=20       -> só ampla cobertura
//   /api/diagnostico-conab-catalogo?classificacao=GRAO  -> por categoria
//   /api/diagnostico-conab-catalogo?formato=resumo      -> lista enxuta

import { catalogoCompleto } from './_conabPrecos';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const classificacao = url.searchParams.get('classificacao') || undefined;
  const minEstados = Number(url.searchParams.get('minEstados') || '0');
  const formato = url.searchParams.get('formato') || 'completo';

  const r = await catalogoCompleto(classificacao);
  const filtrados = r.itens.filter(i => i.estadosComAmostraBoa >= minEstados);

  if (formato === 'resumo') {
    return new Response(JSON.stringify({
      classificacoesDisponiveis: r.classificacoesDisponiveis,
      totalDeProdutos: r.total,
      produtos: filtrados.map(i =>
        `${i.nome} | ${i.estadosComAmostraBoa} UF com amostra boa (${i.estados} total) | R$ ${i.precoMin}-${i.precoMax} | ${i.temNivelProdutor ? 'tem preço de produtor' : 'SEM preço de produtor'} | até ${i.ultimoMes}`),
      diagnostico: r.diagnostico,
    }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  return new Response(JSON.stringify({
    classificacoesDisponiveis: r.classificacoesDisponiveis,
    totalDeProdutos: r.total,
    filtroAplicado: { classificacao: classificacao || '(nenhum)', minEstados },
    produtosRetornados: filtrados.length,
    produtos: filtrados,
    diagnostico: r.diagnostico,
  }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
