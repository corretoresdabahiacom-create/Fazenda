/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Faixas de referência pra detectar preço fora do esperado antes de
// mostrar — não são calculadas de um histórico (o app ainda não guarda
// isso), são limites amplos baseados no comportamento real de mercado
// dos últimos anos, com bastante margem pra não acusar falso positivo
// numa alta/baixa forte real. O objetivo é só pegar erro grosseiro de
// leitura da fonte (ex: vírgula decimal lida errada), não julgar se um
// preço é "bom" ou "ruim" — revisar periodicamente conforme o mercado
// muda de patamar. Compartilhado entre a tela de Cotações e o
// Consultor Rural IA, pra manter a mesma regra nos dois lugares.
export const PRICE_SANITY_RANGES: Record<string, [number, number]> = {
  boi_gordo: [200, 500],
  vaca: [180, 450],
  novilho: [180, 450],
  novilha: [180, 450],
  soja: [80, 220],
  milho: [30, 110],
  cafe_arabica: [800, 3000],
  cafe_conilon: [500, 2200],
  algodao: [80, 250],
  trigo: [40, 130],
  arroz: [50, 150],
  feijao: [120, 550],
  acucar: [60, 180],
  suinos: [3, 15],
  frango: [3, 12],
  leite: [1, 5],
  sorgo: [25, 90],
  cacau: [500, 2000],
};

// Extrai o primeiro número plausível de uma célula/texto de preço
// (aceita "345,50", "R$ 345,50", "4700,00", "4.700,00" etc).
export function extractNumber(cell: string): number | null {
  const match = cell.match(/[\d]+(?:[.,]\d+)*/);
  if (!match) return null;
  let raw = match[0];
  if (raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (raw.match(/\./g) || []).length;
    if (dotCount > 1 || !/\.\d{2}$/.test(raw)) {
      raw = raw.replace(/\./g, '');
    }
  }
  const num = Number(raw);
  return isNaN(num) ? null : num;
}

export function isPriceAnomalous(produto: string, priceStr: string | undefined | null): boolean {
  const range = PRICE_SANITY_RANGES[produto];
  if (!range || !priceStr) return false;
  const value = extractNumber(priceStr);
  if (value === null) return false;
  return value < range[0] || value > range[1];
}
