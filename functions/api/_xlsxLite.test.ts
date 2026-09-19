import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { lerXlsx } from './_xlsxLite';

function montarXlsx(sheetXml: string, shared: string[], styles = ''): Uint8Array {
  return zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Preços diários" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8(`<sst>${shared.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`),
    'xl/styles.xml': strToU8(styles || '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`),
  });
}

describe('lerXlsx', () => {
  it('lê abas, textos compartilhados, números e datas', () => {
    const xml =
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" s="1"><v>46023</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>320.5</v></c></row>';
    const p = lerXlsx(montarXlsx(xml, ['Data', 'Produto', 'Preço', 'Boi gordo &amp; cia']));
    expect(p.abas).toEqual(['Preços diários']);
    expect(p.lerAba('Preços diários')).toEqual([
      ['Data', 'Produto', 'Preço'],
      ['2026-01-01', 'Boi gordo & cia', '320.5'],
    ]);
  });

  it('respeita colunas vazias e texto inline', () => {
    const xml = '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c><c r="C1"><v>7</v></c></row>';
    expect(lerXlsx(montarXlsx(xml, [])).lerAba('Preços diários')).toEqual([['x', '', '7']]);
  });

  it('não trata número comum como data', () => {
    const xml = '<row r="1"><c r="A1" s="0"><v>46023</v></c></row>';
    expect(lerXlsx(montarXlsx(xml, [])).lerAba('Preços diários')).toEqual([['46023']]);
  });

  it('rejeita arquivo que não é xlsx', () => {
    expect(() => lerXlsx(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
