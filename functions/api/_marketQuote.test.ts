/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// SEÇÃO 35 do documento original: 15 cenários de teste obrigatórios.
// Cada teste abaixo referencia explicitamente qual cenário cobre.

import { describe, it, expect } from 'vitest';
import {
  isValidPrice, findPriceCell,
  normalizeNoticiasAgricolas, normalizeIeaSp, normalizeIncaperEs, normalizeEpagriSc,
  normalizeAiba, normalizeTradingEconomics, normalizeBoiMundo,
} from './_marketQuote';

describe('Cenário 1: API retorna preço', () => {
  it('normaliza um preço válido corretamente (IEA-SP)', () => {
    const data = {
      recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: '342,50' }],
      sourceUrl: 'http://exemplo.gov.br', fetchedAt: '2026-09-09T12:00:00.000Z',
    };
    const result = normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo');
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(342.5);
    expect(result[0].isAvailable).toBe(true);
  });
});

describe('Cenário 2: API retorna null', () => {
  it('trata preço null como indisponível, nunca como zero', () => {
    const data = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: null }] };
    const result = normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo');
    expect(result[0].price).toBeNull();
    expect(result[0].isAvailable).toBe(false);
  });
});

describe('Cenário 3: API está indisponível (resposta vazia/nula)', () => {
  it('não quebra e devolve lista vazia quando a resposta é null', () => {
    expect(normalizeNoticiasAgricolas(null, 'boi_gordo', 'Boi Gordo')).toEqual([]);
    expect(normalizeIeaSp(null, 'boi_gordo', 'Boi Gordo')).toEqual([]);
    expect(normalizeAiba(null, 'soja', 'Soja')).toEqual([]);
    expect(normalizeTradingEconomics(null, 'boi_gordo', 'Boi Gordo')).toEqual([]);
    expect(normalizeBoiMundo(null, 'boi_gordo', 'Boi Gordo')).toEqual([]);
  });

  it('não quebra com objeto vazio {}', () => {
    expect(normalizeNoticiasAgricolas({}, 'boi_gordo', 'Boi Gordo')).toEqual([]);
    expect(normalizeIeaSp({}, 'boi_gordo', 'Boi Gordo')).toEqual([]);
  });
});

describe('Cenário 4: API retorna preço antigo (desatualizado)', () => {
  it('preserva o fetchedAt pra quem for checar desatualização depois', () => {
    const dataAntiga = '2020-01-01T00:00:00.000Z';
    const data = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: '300,00' }], fetchedAt: dataAntiga };
    const result = normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo');
    expect(result[0].fetchedAt).toBe(dataAntiga);
    // A checagem de "é antigo?" fica pro alertLogic.test.ts (isStale) —
    // aqui só confirmamos que o dado passa adiante sem se perder.
  });
});

describe('Cenário 5: API retorna estado inexistente', () => {
  it('AIBA sempre marca Bahia fixo (fonte é regional) — não aceita outro estado por engano', () => {
    const data = { rows: [{ produto: 'Soja Disponível', unidade: 'Saca 60kg', preco: '136,67', data: '09/09/2026' }], sourceUrl: 'x' };
    const result = normalizeAiba(data, 'soja', 'Soja');
    expect(result[0].state).toBe('Bahia');
    expect(result[0].stateCode).toBe('BA');
  });

  it('Notícias Agrícolas agora detecta estado quando a linha é literalmente um nome de estado ou UF (antes sempre ficava null)', () => {
    const data = {
      tables: [{ heading: 'Boi Gordo por Estado', source: 'Scot Consultoria', rows: [
        ['Estado', 'R$/@'],
        ['Bahia', '312,72'],
        ['SP', '349,50'],
        ['Feira de Santana', '308,00'], // cidade real, não deve virar "estado"
      ]}],
      sourceUrl: 'x',
    };
    const result = normalizeNoticiasAgricolas(data, 'boi_gordo', 'Boi Gordo');
    expect(result[0].state).toBe('Bahia');
    expect(result[1].state).toBe('São Paulo');
    expect(result[2].state).toBeNull(); // cidade continua sem estado detectado, é esperado
    expect(result[2].municipality).toBe('Feira de Santana');
  });
});

describe('Cenário 6: API retorna produto inexistente (sem correspondência)', () => {
  it('retorna lista vazia quando não há nenhuma linha', () => {
    const dataVazia = { rows: [], sourceUrl: 'x' };
    expect(normalizeAiba(dataVazia, 'ovelha', 'Ovelha')).toEqual([]);
  });

  // BUG REAL ENCONTRADO EM PRODUÇÃO (auditoria externa) e corrigido:
  // os normalizadores percorriam TODAS as linhas de uma fonte que traz
  // vários produtos numa resposta só (ex: AIBA devolve Soja, Milho,
  // Sorgo, Café etc. juntos) e rotulavam CADA linha com o produto
  // PEDIDO, mesmo quando a linha era de outro produto — pedir "milho"
  // podia devolver o preço da Soja rotulado como Milho. Esse era
  // exatamente o ponto cego do teste acima (só testava lista vazia,
  // nunca lista com produtos MISTURADOS).
  it('NÃO confunde uma linha de outro produto com o produto pedido — bug real encontrado por auditoria externa', () => {
    const data = {
      rows: [
        { produto: 'Soja Disponível', unidade: 'Saca 60kg', preco: '136,67', data: '09/09/2026' },
        { produto: 'Milho', unidade: 'Saca 60kg', preco: '65,00', data: '08/09/2026' },
        { produto: 'Café', unidade: 'Saca 60kg', preco: '1540,00', data: '08/09/2026' },
      ],
      sourceUrl: 'x',
    };
    // Pedindo "milho", só a linha de Milho deve voltar — nunca Soja ou Café rotulados como Milho.
    const resultadoMilho = normalizeAiba(data, 'milho', 'Milho');
    expect(resultadoMilho).toHaveLength(1);
    expect(resultadoMilho[0].price).toBe(65);

    // Pedindo "soja", só a linha de Soja deve voltar.
    const resultadoSoja = normalizeAiba(data, 'soja', 'Soja');
    expect(resultadoSoja).toHaveLength(1);
    expect(resultadoSoja[0].price).toBe(136.67);

    // Pedindo um produto que não está em nenhuma linha (ex: arroz nessa amostra), nada deve voltar.
    expect(normalizeAiba(data, 'arroz', 'Arroz')).toEqual([]);
  });

  it('IEA-SP não confunde Boi Gordo com Boi Gordo (China) — são produtos diferentes', () => {
    const data = {
      recebidosPelosProdutores: [
        { produto: 'Boi gordo', unidade: '@', preco: '342,50' },
        { produto: 'Boi gordo (China)', unidade: '@', preco: '348,75' },
      ],
      sourceUrl: 'x',
    };
    const resultado = normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].price).toBe(342.5);
  });

  it('Incaper reconhece variantes "Castrado"/"Inteiro" como Boi Gordo, mas não confunde com Vaca Gorda', () => {
    const data = {
      precos: [
        { produto: 'Boi Gordo Castrado', minimo: 'R$ 340,00', medio: 'R$ 340,00', maximo: 'R$ 340,00' },
        { produto: 'Vaca Gorda', minimo: 'R$ 310,00', medio: 'R$ 321,86', maximo: 'R$ 330,00' },
      ],
      sourceUrl: 'x',
    };
    const resultadoBoi = normalizeIncaperEs(data, 'boi_gordo', 'Boi Gordo');
    expect(resultadoBoi).toHaveLength(1);
    expect(resultadoBoi[0].price).toBe(340);

    const resultadoVaca = normalizeIncaperEs(data, 'vaca', 'Vaca');
    expect(resultadoVaca).toHaveLength(1);
    expect(resultadoVaca[0].price).toBe(321.86);
  });
});

describe('Cenário 7: API retorna unidade diferente', () => {
  it('preserva a unidade exata informada pela fonte, sem converter sozinho', () => {
    const dataArroba = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: '342,50' }] };
    const dataSaca = { rows: [{ produto: 'Milho', unidade: 'Saca 60kg', preco: '65,00', data: '08/09/2026' }], sourceUrl: 'x' };
    expect(normalizeIeaSp(dataArroba, 'boi_gordo', 'Boi Gordo')[0].unit).toBe('@');
    expect(normalizeAiba(dataSaca, 'milho', 'Milho')[0].unit).toBe('Saca 60kg');
  });
});

describe('Cenário 8: API retorna preço zero', () => {
  it('NUNCA trata preço 0 como disponível (regra da seção 16)', () => {
    expect(isValidPrice(0)).toBe(false);
    const data = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: '0,00' }] };
    const result = normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo');
    expect(result[0].price).toBeNull();
    expect(result[0].isAvailable).toBe(false);
  });
});

describe('Cenário 9: API retorna preço negativo', () => {
  it('NUNCA trata preço negativo como disponível', () => {
    expect(isValidPrice(-50)).toBe(false);
    const data = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: '-50,00' }] };
    const result = normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo');
    expect(result[0].price).toBeNull();
    expect(result[0].isAvailable).toBe(false);
  });
});

describe('Cenário 10: API retorna preço muito acima da média (anomalia)', () => {
  it('isValidPrice sozinho não julga "muito alto" — isso é responsabilidade do priceSanity.ts, testado separadamente', () => {
    // Preço de R$ 50.000/@ é tecnicamente um número válido (positivo,
    // finito) — a detecção de "isso não faz sentido pro mercado" é uma
    // camada diferente (ver priceSanity.test.ts), de propósito: aqui só
    // validamos que o formato do NÚMERO está correto, não o quão
    // plausível ele é.
    expect(isValidPrice(50000)).toBe(true);
  });
});

describe('Cenário 11: API ultrapassa rate limit', () => {
  it('não se aplica — nenhuma fonte ativa hoje é uma API com cota', () => {
    // Documentado explicitamente: todas as fontes ativas são páginas
    // públicas raspadas (sem chave de API, sem limite de requisições
    // conhecido), então não existe lógica de rate-limit pra testar
    // ainda. Ver functions/api/adapters-status.ts pra fontes que
    // futuramente teriam esse problema (Datagro, Scot granular).
    expect(true).toBe(true);
  });
});

describe('Cenário 12: Fonte muda estrutura JSON', () => {
  it('não quebra quando faltam campos esperados', () => {
    expect(() => normalizeNoticiasAgricolas({ tables: [{ heading: 'X' }] }, 'boi_gordo', 'Boi Gordo')).not.toThrow();
    expect(() => normalizeIeaSp({ recebidosPelosProdutores: [{}] }, 'boi_gordo', 'Boi Gordo')).not.toThrow();
    expect(() => normalizeEpagriSc({ boiGordo: {} }, 'boi_gordo', 'Boi Gordo')).not.toThrow();
  });

  it('não quebra quando um campo vem com tipo errado (número em vez de string)', () => {
    const data = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: 342.5 }] };
    expect(() => normalizeIeaSp(data, 'boi_gordo', 'Boi Gordo')).not.toThrow();
  });

  it('findPriceCell não confunde rótulo de contrato (Out/2026) com preço — bug real encontrado e corrigido', () => {
    expect(findPriceCell(['Out/2026', '377,50'])).toBe('377,50');
    expect(findPriceCell(['Set/26', '362,30'])).toBe('362,30');
    expect(findPriceCell(['SP', '348,35'])).toBe('348,35');
  });
});

describe('Cenário 13: Duas fontes apresentam preços diferentes', () => {
  it('cada fonte devolve seu próprio MarketQuote independente — a comparação é feita pelo alertLogic (ver alertLogic.test.ts)', () => {
    const ieaData = { recebidosPelosProdutores: [{ produto: 'Boi gordo', unidade: '@', preco: '342,50' }], sourceUrl: 'iea' };
    const aibaData = { rows: [{ produto: 'Boi Gordo', unidade: '@', preco: '350,00', data: '09/09/2026' }], sourceUrl: 'aiba' };
    const q1 = normalizeIeaSp(ieaData, 'boi_gordo', 'Boi Gordo');
    const q2 = normalizeAiba(aibaData, 'boi_gordo', 'Boi Gordo');
    expect(q1[0].price).toBe(342.5);
    expect(q2[0].price).toBe(350);
    expect(q1[0].source).not.toBe(q2[0].source);
  });
});

describe('Cenário 14: Bahia não possui determinada cotação', () => {
  it('retorna lista vazia em vez de inventar quando a AIBA não tem linhas', () => {
    const data = { rows: [], sourceUrl: 'https://aiba.org.br/cotacoes/' };
    expect(normalizeAiba(data, 'ovelha', 'Ovelha')).toEqual([]);
  });
});

describe('Cenário 15: Fonte possui somente preço nacional', () => {
  it('TradingEconomics não define estado (é referência nacional/internacional) — nunca finge ser de um estado específico', () => {
    const data = { preco: 347.7, unidade: 'R$/@ (15kg)', sourceUrl: 'x', fetchedAt: '2026-09-09T00:00:00.000Z' };
    const result = normalizeTradingEconomics(data, 'boi_gordo', 'Boi Gordo');
    expect(result[0].state).toBeNull();
    expect(result[0].sourceKind).toBe('internacional');
  });
});
