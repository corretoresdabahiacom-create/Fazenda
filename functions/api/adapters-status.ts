// FASE 3 do motor de cotações: adapters "preparados, mas desabilitados"
// para fontes que existem de verdade, mas que não conseguimos consumir
// com dado real agora — nenhum deles inventa preço. Cada um documenta
// exatamente POR QUE está desabilitado, e o que precisaria mudar pra
// ativar de verdade.
//
// Diferença importante em relação às fontes já ativas (Notícias
// Agrícolas, IEA-SP, Incaper-ES, Epagri-SC, AIBA, Scot "Boi no Mundo",
// TradingEconomics): aquelas foram testadas e confirmadas trazendo
// número real. Estas aqui, não — ou porque a fonte carrega os dados via
// JavaScript (não capturável por uma busca simples de servidor), ou
// porque exige contrato comercial pago que ainda não temos.

export type AdapterStatus = 'nao_configurada' | 'requer_javascript' | 'requer_contrato_pago';

export interface AdapterInfo {
  nome: string;
  status: AdapterStatus;
  motivo: string;
  urlInvestigada: string;
  proximoPasso: string;
}

// ---------------------------------------------------------------------
// CNA — Confederação da Agricultura e Pecuária do Brasil
// ---------------------------------------------------------------------
// Confirmado na Fase 1 (revisão): a CNA TEM um "Sistema de Preços de
// Commodities" real (cnabrasil.org.br/servicos/precos-commodities),
// com formulário de Produto + Estado. Mas ao buscar a página direto,
// a tabela de resultados vem com só o cabeçalho (Produto | UF | Praça |
// Preço do dia | Variação mensal) e nenhuma linha — os dados são
// carregados via JavaScript depois que o usuário escolhe produto e
// estado no formulário, o que uma busca simples de servidor não executa.
export const CNA_ADAPTER: AdapterInfo = {
  nome: 'CNA — Preços das Commodities',
  status: 'requer_javascript',
  motivo: 'A tabela de resultados só é preenchida via JavaScript, depois de escolher Produto e Estado no formulário do próprio site — uma busca direta ao servidor traz só o cabeçalho vazio.',
  urlInvestigada: 'https://cnabrasil.org.br/servicos/precos-commodities',
  proximoPasso: 'Precisaria descobrir o endpoint interno (XHR) que o formulário chama ao ser preenchido — só é possível inspecionando o tráfego de rede no navegador enquanto alguém usa o formulário manualmente (Ferramentas do Desenvolvedor → aba Network), já que a sandbox de desenvolvimento não tem acesso a esse domínio pra investigar por conta própria.',
};

// ---------------------------------------------------------------------
// Scot Consultoria — dados granulares (preço bruto/líquido, base,
// Funrural, Senar, à vista/30 dias)
// ---------------------------------------------------------------------
// Diferente do "Boi no Mundo" (já ativo — vem em tabela HTML de
// verdade), essa granularidade completa (preco_bruto, preco_liquido,
// preco_a_vista, preco_30_dias, base, funrural, senar) não está
// disponível nas páginas públicas do site — exigiria acesso ao
// relatório pago "Tem Boi na Linha" ou uma API comercial que a Scot não
// disponibiliza publicamente.
export const SCOT_GRANULAR_ADAPTER: AdapterInfo = {
  nome: 'Scot Consultoria — dados granulares (bruto/líquido/base/Funrural/Senar)',
  status: 'requer_contrato_pago',
  motivo: 'As páginas públicas do site (já usamos "Boi no Mundo") não expõem esse nível de detalhe — esses campos aparecem no relatório pago "Tem Boi na Linha", que exige assinatura.',
  urlInvestigada: 'https://www.scotconsultoria.com.br/cotacoes/boi-gordo/',
  proximoPasso: 'Se a Scot tiver um plano de API comercial ou parceria de dados, seria necessário assinar e obter credenciais — não encontramos essa oferta documentada publicamente até agora.',
};

// ---------------------------------------------------------------------
// Datagro
// ---------------------------------------------------------------------
// Confirmado na Fase 1: o site é uma aplicação JavaScript moderna sem
// conteúdo renderizado no servidor — uma busca direta traz a página
// praticamente vazia. O produto real deles (Datagro Markets) é vendido
// como serviço comercial.
export const DATAGRO_ADAPTER: AdapterInfo = {
  nome: 'Datagro',
  status: 'requer_contrato_pago',
  motivo: 'O site é uma aplicação JavaScript (React/Next.js) sem conteúdo renderizado no servidor — confirmado por teste direto, a página vem vazia numa busca simples. Os dados reais são vendidos via "Datagro Markets", produto comercial.',
  urlInvestigada: 'https://www.datagro.com',
  proximoPasso: 'Contratar o Datagro Markets e obter credenciais de API/feed junto à empresa.',
};

export const PREPARED_ADAPTERS: AdapterInfo[] = [CNA_ADAPTER, SCOT_GRANULAR_ADAPTER, DATAGRO_ADAPTER];

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({
    fase: 'FASE 3 — adapters preparados, mas desabilitados',
    adapters: PREPARED_ADAPTERS,
    aviso: 'Nenhum desses retorna preço — todos aguardam acesso real (ver "proximoPasso" de cada um). Isso é intencional: melhor mostrar "não configurado" do que inventar número.',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
