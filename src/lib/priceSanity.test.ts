/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { extractNumber, isPriceAnomalous, findPriceCell, PRICE_SANITY_RANGES } from './priceSanity';

describe('extractNumber', () => {
  it('extrai formato decimal brasileiro simples', () => {
    expect(extractNumber('345,50')).toBe(345.5);
  });
  it('extrai com prefixo R$', () => {
    expect(extractNumber('R$ 345,50')).toBe(345.5);
  });
  it('extrai com separador de milhar', () => {
    expect(extractNumber('1.540,00')).toBe(1540);
  });
  it('extrai valor de 4 dígitos sem separador de milhar (bug real corrigido)', () => {
    expect(extractNumber('4700,00')).toBe(4700);
  });
  it('extrai valor de 4 dígitos COM separador de milhar', () => {
    expect(extractNumber('4.700,00')).toBe(4700);
  });
  it('retorna null quando não há número', () => {
    expect(extractNumber('sem cotação')).toBeNull();
  });
});

describe('isPriceAnomalous (Cenário 10: preço muito acima da média)', () => {
  it('não marca como anômalo um preço dentro da faixa normal de boi gordo', () => {
    expect(isPriceAnomalous('boi_gordo', '348,35')).toBe(false);
  });

  it('marca como anômalo um preço absurdamente baixo (possível bug de vírgula)', () => {
    expect(isPriceAnomalous('boi_gordo', '34,50')).toBe(true);
  });

  it('marca como anômalo um preço absurdamente alto', () => {
    expect(isPriceAnomalous('boi_gordo', '5000,00')).toBe(true);
  });

  it('não quebra e não marca anomalia pra produto sem faixa configurada', () => {
    expect(isPriceAnomalous('produto_desconhecido', '999999,00')).toBe(false);
  });

  it('não quebra com string vazia ou undefined', () => {
    expect(isPriceAnomalous('boi_gordo', '')).toBe(false);
    expect(isPriceAnomalous('boi_gordo', undefined)).toBe(false);
  });

  it('todas as faixas configuradas têm mínimo menor que máximo (checagem de sanidade da própria configuração)', () => {
    for (const [produto, [min, max]] of Object.entries(PRICE_SANITY_RANGES)) {
      expect(min, `faixa de ${produto}`).toBeLessThan(max);
      expect(min, `faixa de ${produto}`).toBeGreaterThan(0);
    }
  });
});

describe('findPriceCell (bug real: confundir rótulo de contrato com preço)', () => {
  it('acha o preço mesmo quando vem depois de um rótulo de mês/ano', () => {
    expect(findPriceCell(['Out/2026', '377,50'])).toBe('377,50');
  });
  it('acha o preço numa linha "atual" normal', () => {
    expect(findPriceCell(['SP', '348,35'])).toBe('348,35');
  });
  it('acha preço sem separador de milhar (garrote por cabeça)', () => {
    expect(findPriceCell(['Garrote', '4700,00'])).toBe('4700,00');
  });
  it('retorna undefined pra linha sem nenhum preço', () => {
    expect(findPriceCell(['Produto', 'Sem cotação'])).toBeUndefined();
  });
  it('retorna undefined pra linha vazia', () => {
    expect(findPriceCell([])).toBeUndefined();
  });
});
