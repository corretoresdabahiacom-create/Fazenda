// Cobertura da CONAB por estado. Responde: "para este produto, quais
// estados têm preço publicado?" — e, por consequência, em quais o
// gráfico vai cair na fonte de reserva (IPEADATA/Paraná) com aviso.
//
// Um produto:   /api/diagnostico-conab-cobertura?produto=boi_gordo
// Vários:       /api/diagnostico-conab-cobertura?produto=boi_gordo,soja,milho
// Todos:        /api/diagnostico-conab-cobertura?produto=todos

import { exigirTokenDiagnostico } from './_diagnosticoGuard';
import { coberturaPorEstado } from './_conabPrecos';

const TODOS = [
  'boi_gordo', 'vaca', 'novilho', 'novilha', 'bezerro', 'bezerra',
  'soja', 'milho', 'cafe', 'algodao', 'arroz', 'feijao', 'trigo', 'sorgo', 'leite', 'acucar',
];

export const onRequestGet: PagesFunction = async (context) => {
  const bloqueio = exigirTokenDiagnostico(context.request, context.env);
  if (bloqueio) return bloqueio;
  const url = new URL(context.request.url);
  const pedido = url.searchParams.get('produto') || 'boi_gordo';
  const produtos = pedido === 'todos' ? TODOS : pedido.split(',').map(p => p.trim()).filter(Boolean);

  const resultados = [];
  for (const p of produtos) {
    const r = await coberturaPorEstado(p);
    resultados.push({
      produto: r.produtoBuscado,
      nomeNoArquivoDaConab: r.nomeNoArquivo,
      totalDeLinhas: r.totalLinhas,
      quantosEstadosCobertos: r.estadosCobertos.length,
      estadosCobertos: r.estadosCobertos,
      estadosSemDadoNaConab: r.estadosSemDados,
      diagnostico: r.diagnostico,
    });
  }

  return new Response(JSON.stringify({
    resumo: resultados.map(r => `${r.produto}: ${r.quantosEstadosCobertos} estado(s)`),
    detalhe: resultados,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
