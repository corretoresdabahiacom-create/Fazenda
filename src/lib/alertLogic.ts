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
// diretamente) e entradas sem preço.
export function detectDivergence(quotes: SimpleQuote[]): DivergenceResult {
  const precosBRL = quotes.filter(q => q.currency === 'BRL' && q.price != null && q.price > 0);
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
