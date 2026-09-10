/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { detectDivergence, isStale, checkTargetReached } from './alertLogic';

describe('detectDivergence (Cenário 13: duas fontes com preços diferentes)', () => {
  it('não alerta quando os preços estão próximos', () => {
    const result = detectDivergence([
      { source: 'Cepea', price: 348.35, currency: 'BRL' },
      { source: 'IEA-SP', price: 342.5, currency: 'BRL' },
    ]);
    expect(result.hasDivergence).toBe(false);
  });

  it('alerta quando a diferença passa de 10%', () => {
    const result = detectDivergence([
      { source: 'Cepea', price: 348.35, currency: 'BRL' },
      { source: 'FonteErrada', price: 250.0, currency: 'BRL' },
    ]);
    expect(result.hasDivergence).toBe(true);
    expect(result.maisAlta?.source).toBe('Cepea');
    expect(result.maisBaixa?.source).toBe('FonteErrada');
  });

  it('ignora entradas de moeda diferente (não compara USD com BRL)', () => {
    const result = detectDivergence([
      { source: 'Cepea', price: 348.35, currency: 'BRL' },
      { source: 'Boi no Mundo', price: 67.31, currency: 'USD' },
    ]);
    expect(result.hasDivergence).toBe(false);
  });

  it('não quebra com uma única fonte', () => {
    const result = detectDivergence([{ source: 'Cepea', price: 348.35, currency: 'BRL' }]);
    expect(result.hasDivergence).toBe(false);
  });

  it('não quebra com lista vazia', () => {
    expect(detectDivergence([]).hasDivergence).toBe(false);
  });

  it('ignora entradas com preço nulo ou zero', () => {
    const result = detectDivergence([
      { source: 'A', price: null, currency: 'BRL' },
      { source: 'B', price: 0, currency: 'BRL' },
      { source: 'C', price: 300, currency: 'BRL' },
    ]);
    expect(result.hasDivergence).toBe(false); // só 1 preço válido, não dá pra comparar
  });
});

describe('isStale (Cenário 4: preço antigo)', () => {
  it('detecta cotação com mais de 48h', () => {
    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStale(tresDiasAtras)).toBe(true);
  });

  it('não marca como desatualizado dentro de 48h', () => {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isStale(umaHoraAtras)).toBe(false);
  });

  it('retorna null (não assume) quando não há data pra checar', () => {
    expect(isStale(undefined)).toBeNull();
  });

  it('retorna null com data inválida, em vez de quebrar', () => {
    expect(isStale('isso não é uma data')).toBeNull();
  });

  it('respeita um limite de horas customizado', () => {
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(isStale(duasHorasAtras, 1)).toBe(true);
    expect(isStale(duasHorasAtras, 24)).toBe(false);
  });
});

describe('checkTargetReached (alvo de preço definido pelo usuário)', () => {
  it('dispara quando o preço atual é igual ou maior que o alvo', () => {
    expect(checkTargetReached(350, 340)).toBe(true);
    expect(checkTargetReached(340, 340)).toBe(true);
  });

  it('não dispara quando o preço está abaixo do alvo', () => {
    expect(checkTargetReached(330, 340)).toBe(false);
  });

  it('nunca dispara sem preço ou sem alvo definido', () => {
    expect(checkTargetReached(null, 340)).toBe(false);
    expect(checkTargetReached(350, null)).toBe(false);
    expect(checkTargetReached(null, null)).toBe(false);
  });

  it('nunca dispara com preço ou alvo zero/negativo (dado inválido)', () => {
    expect(checkTargetReached(0, 340)).toBe(false);
    expect(checkTargetReached(350, -10)).toBe(false);
  });
});
