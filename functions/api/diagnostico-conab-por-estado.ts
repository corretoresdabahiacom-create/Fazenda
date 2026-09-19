// Produtos disponíveis POR ESTADO no arquivo da CONAB — com preço de
// produtor e amostra suficiente.
//
// Já vem com os estados prioritários:
//   /api/diagnostico-conab-por-estado
// Ou escolha:
//   /api/diagnostico-conab-por-estado?uf=BA,SP,MT
//   /api/diagnostico-conab-por-estado?uf=todos&formato=resumo

import { exigirTokenDiagnostico } from './_diagnosticoGuard';
import { produtosDoEstado } from './_conabPrecos';

const PRIORITARIOS = ['BA', 'SP', 'MT', 'MS', 'SC'];
const TODOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export const onRequestGet: PagesFunction = async (context) => {
  const bloqueio = exigirTokenDiagnostico(context.request, context.env);
  if (bloqueio) return bloqueio;
  const url = new URL(context.request.url);
  const pedido = url.searchParams.get('uf');
  const formato = url.searchParams.get('formato') || 'resumo';

  const ufs = !pedido ? PRIORITARIOS
    : pedido.toLowerCase() === 'todos' ? TODOS
    : pedido.split(',').map(u => u.trim().toUpperCase()).filter(Boolean);

  const resultados = [];
  for (const uf of ufs) {
    const r = await produtosDoEstado(uf);
    resultados.push(
      formato === 'resumo'
        ? {
            uf: r.uf,
            totalDeProdutos: r.total,
            // Uma linha por produto — mais fácil de ler e de copiar.
            produtos: r.produtos.map(p =>
              `${p.nome} | ${p.pontos} pts | R$ ${p.precoMin}-${p.precoMax} | atual R$ ${p.precoMaisRecente} | até ${p.ultimoMes}`),
          }
        : { uf: r.uf, totalDeProdutos: r.total, produtos: r.produtos, diagnostico: r.diagnostico }
    );
  }

  return new Response(JSON.stringify({
    estadosConsultados: ufs,
    resumo: resultados.map(r => `${r.uf}: ${r.totalDeProdutos} produtos`),
    detalhe: resultados,
  }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
