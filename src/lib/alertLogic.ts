/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Funções puras de detecção de alerta (seção 27), extraídas do
// componente AlertasCotacoes.tsx pra poderem ser testadas isoladamente,
// sem precisar simular React nem Firebase.

export interface SimpleQuote {
  source: string;
  price: number | null;
  currency: 'BRL' | 'USD';
  fetchedAt?: string;
  priceType?: string;
}

export interface DivergenceResult {
  hasDivergence: boolean;
  maisAlta?: { source: string; price: number };
  maisBaixa?: { source: string; price: number };
  percentualDiferenca?: number;
}

// Compara preços em BRL de múltiplas fontes pro mesmo produto — alerta
// quando a diferença entre a maior e a menor passa de 10%. Ignora
// entradas com moeda diferente (não faz sentido comparar USD com BRL
// diretamente), entradas sem preço, e — importante — só compara
// cotações do MESMO tipo (ex: só "à vista" com "à vista"). Preço futuro
// e preço à vista são coisas diferentes por natureza, não uma
// "divergência" entre fontes; misturar os dois gerava alertas falsos
// (bug real reportado em produção).
export function detectDivergence(quotes: SimpleQuote[]): DivergenceResult {
  const candidatos = quotes.filter(q => q.currency === 'BRL' && q.price != null && q.price > 0);
  // Agrupa por priceType (tratando "sem tipo definido" como um grupo
  // próprio) e só compara dentro do mesmo grupo.
  const grupos = new Map<string, SimpleQuote[]>();
  for (const q of candidatos) {
    const chave = q.priceType || 'indicador';
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(q);
  }
  // Prioriza o grupo "indicador"/"a_vista" quando existir (é o que o
  // usuário normalmente quer ver como "preço atual"); senão, usa
  // qualquer grupo com 2+ itens.
  const precosBRL = grupos.get('indicador') || grupos.get('a_vista') || Array.from(grupos.values()).find(g => g.length >= 2) || [];
  if (precosBRL.length < 2) return { hasDivergence: false };

  const valores = precosBRL.map(p => p.price as number);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (min <= 0) return { hasDivergence: false };

  const percentualDiferenca = (max - min) / min;
  if (percentualDiferenca <= 0.1) return { hasDivergence: false };

  const maisAltaQuote = precosBRL.find(p => p.price === max)!;
  const maisBaixaQuote = precosBRL.find(p => p.price === min)!;
  return {
    hasDivergence: true,
    maisAlta: { source: maisAltaQuote.source, price: max },
    maisBaixa: { source: maisBaixaQuote.source, price: min },
    percentualDiferenca,
  };
}

// Verifica se uma cotação está desatualizada (mais de N horas desde a
// busca). Retorna null se não houver fetchedAt pra checar (não assume
// desatualizado por falta de dado — só quando consegue calcular de
// verdade).
export function isStale(fetchedAt: string | undefined, limiteHoras = 48): boolean | null {
  if (!fetchedAt) return null;
  const data = new Date(fetchedAt);
  if (isNaN(data.getTime())) return null;
  const horasAtras = (Date.now() - data.getTime()) / (1000 * 60 * 60);
  return horasAtras > limiteHoras;
}

// Verifica se o preço atual atingiu ou passou de um alvo definido pelo
// usuário. Nunca dispara se faltar preço ou alvo válido.
export function checkTargetReached(precoAtual: number | null, alvo: number | null): boolean {
  if (precoAtual == null || alvo == null || precoAtual <= 0 || alvo <= 0) return false;
  return precoAtual >= alvo;
}
