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

describe('detectDivergence — não confunde à vista com futuro (bug real reportado)', () => {
  it('não alerta comparando um preço à vista com um preço futuro da mesma fonte', () => {
    const result = detectDivergence([
      { source: 'Notícias Agrícolas', price: 349.50, currency: 'BRL', priceType: 'indicador' },
      { source: 'Notícias Agrícolas', price: 377.50, currency: 'BRL', priceType: 'futuro' },
    ]);
    expect(result.hasDivergence).toBe(false);
  });

  it('ainda detecta divergência real entre duas fontes À VISTA de verdade', () => {
    const result = detectDivergence([
      { source: 'Cepea', price: 349.50, currency: 'BRL', priceType: 'indicador' },
      { source: 'FonteErrada', price: 156.00, currency: 'BRL', priceType: 'indicador' },
    ]);
    expect(result.hasDivergence).toBe(true);
  });
});

describe('detectDivergence — não confunde diferença REGIONAL com erro de dado', () => {
  it('preço nacional vs preço de estado não deve ser tratado como divergência de fonte', () => {
    // Cenário real: indicador nacional Cepea (apurado em SP) vs preço
    // físico da Bahia. Uma diferença de ~5% entre praças é NORMAL no
    // mercado de boi — não é erro de dado. Quem monta a lista deve
    // filtrar por escopo ANTES de comparar; este teste documenta o
    // motivo, comparando só o que é do mesmo estado.
    const soDaBahia = [
      { source: 'Datagro', price: 334.17, currency: 'BRL' as const, priceType: 'indicador' },
    ];
    // Uma fonte só = nada pra comparar = nenhum alerta falso.
    expect(detectDivergence(soDaBahia).hasDivergence).toBe(false);
  });

  it('duas fontes do MESMO escopo com diferença grande continuam gerando alerta', () => {
    const mesmaPraca = [
      { source: 'Fonte A', price: 334.17, currency: 'BRL' as const, priceType: 'indicador' },
      { source: 'Fonte B', price: 180.00, currency: 'BRL' as const, priceType: 'indicador' },
    ];
    expect(detectDivergence(mesmaPraca).hasDivergence).toBe(true);
  });
});

describe('detectDivergence — grupos por tipo e unidade (auditoria)', () => {
  it('cotação sem priceType não é comparada com "indicador"', () => {
    const r = detectDivergence([
      { source: 'A', price: 300, currency: 'BRL', priceType: 'indicador' },
      { source: 'B', price: 400, currency: 'BRL' },
    ]);
    expect(r.hasDivergence).toBe(false);
  });

  it('não compara unidades diferentes', () => {
    const r = detectDivergence([
      { source: 'A', price: 130, currency: 'BRL', priceType: 'a_vista', unit: 'Saca 60kg' },
      { source: 'B', price: 320, currency: 'BRL', priceType: 'a_vista', unit: 'R$/@' },
    ]);
    expect(r.hasDivergence).toBe(false);
  });

  it('grupo "indicador" com 1 item não esconde "a_vista" com 2', () => {
    const r = detectDivergence([
      { source: 'I', price: 300, currency: 'BRL', priceType: 'indicador' },
      { source: 'A', price: 300, currency: 'BRL', priceType: 'a_vista' },
      { source: 'B', price: 400, currency: 'BRL', priceType: 'a_vista' },
    ]);
    expect(r.hasDivergence).toBe(true);
  });
});
