import { describe, it, expect } from 'vitest';

// Espelho dos padrões de _conabPrecos.ts. Duplicar aqui é intencional:
// o arquivo original roda no Cloudflare Worker e não é importável no
// ambiente de teste. O que importa é travar as REGRAS que descobrimos
// na marra, pra não voltarem.
const PADROES: Record<string, RegExp> = {
  leite: /^leite de vaca$/i,
  sorgo: /^sorgo granifero$/i,
  cana_de_acucar: /^cana de acucar$/i,
  boi_gordo: /^boi$/i,
  algodao: /^algodao em pluma$/i,
  borracha: /^borracha natural$/i,
  batata: /^batata$/i,
  batata_doce: /^batata-doce$/i,
};

describe('Nomes de produto da CONAB — conferidos no arquivo real', () => {
  it('leite casa com "LEITE DE VACA" e não com "LEITE"', () => {
    // Bug real: o padrão era /^leite$/i e nunca casou com nada. O leite
    // ficava vazio sem dar erro nenhum.
    expect(PADROES.leite.test('LEITE DE VACA')).toBe(true);
    expect(PADROES.leite.test('LEITE')).toBe(false);
  });

  it('sorgo casa com "SORGO GRANIFERO", o nome real', () => {
    expect(PADROES.sorgo.test('SORGO GRANIFERO')).toBe(true);
    expect(PADROES.sorgo.test('SORGO')).toBe(false);
  });

  it('boi casa com "BOI" e não com "BOI GORDO"', () => {
    // Outro nome que eu tinha errado no começo.
    expect(PADROES.boi_gordo.test('BOI')).toBe(true);
    expect(PADROES.boi_gordo.test('BOI GORDO')).toBe(false);
  });

  it('o que o produtor VENDE não se confunde com o industrializado', () => {
    // "ACUCAR" no arquivo não tem preço de produtor — quem planta vende
    // CANA. Confundir os dois mostraria preço de mercado como se fosse
    // o que o produtor recebe.
    expect(PADROES.cana_de_acucar.test('CANA DE ACUCAR')).toBe(true);
    expect(PADROES.cana_de_acucar.test('ACUCAR')).toBe(false);
  });
});

describe('Padrões ancorados não pegam produto vizinho', () => {
  it('batata não casa com batata-doce (são produtos e preços diferentes)', () => {
    expect(PADROES.batata.test('BATATA')).toBe(true);
    expect(PADROES.batata.test('BATATA-DOCE')).toBe(false);
    expect(PADROES.batata_doce.test('BATATA-DOCE')).toBe(true);
  });

  it('algodão em pluma não casa com caroço de algodão', () => {
    expect(PADROES.algodao.test('ALGODAO EM PLUMA')).toBe(true);
    expect(PADROES.algodao.test('CAROCO DE ALGODAO')).toBe(false);
    expect(PADROES.algodao.test('SEMENTE DE ALGODAO')).toBe(false);
  });

  it('borracha natural não casa com itens de borracha do arquivo', () => {
    expect(PADROES.borracha.test('BORRACHA NATURAL')).toBe(true);
    expect(PADROES.borracha.test('BOTA DE BORRACHA')).toBe(false);
    expect(PADROES.borracha.test('DE BORRACHA')).toBe(false);
  });
});

describe('Máquinas e serviços ficam fora das cotações', () => {
  it('nenhum padrão de produto casa com máquina ou serviço', () => {
    // O arquivo mistura tudo: trator a R$1,7 milhão, colheitadeira,
    // diária de trabalhador. Se algum padrão pegasse isso, o app
    // mostraria preço de máquina como se fosse cotação de produto.
    const naoProdutos = [
      'TRATOR', 'COLHEITADEIRA', 'PULVERIZADOR', 'GRADE NIVELADORA',
      'PA CARREGADEIRA', 'SEMEADEIRA E ADUBADEIRA', 'DISTRIBUIDOR DE ADUBO, CA',
      'DIARISTA SEM ENCARGOS', 'TRANSPORTE EXTERNO', 'ANALISE DE LABORATORIO',
      'SEMENTE DE MILHO', 'SEMENTE DE FEIJAO', 'OLEO DIESEL',
    ];
    for (const item of naoProdutos) {
      for (const [chave, padrao] of Object.entries(PADROES)) {
        expect(padrao.test(item), `"${item}" casou indevidamente com ${chave}`).toBe(false);
      }
    }
  });
});
