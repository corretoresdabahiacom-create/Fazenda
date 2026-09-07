// Busca cotações reais de produtos agropecuários (à vista/CEPEA, futuro/B3
// e preços regionais) a partir do noticiasagricolas.com.br — que consolida
// dados de CEPEA/ESALQ, B3, Scot Consultoria, Datagro e IMEA em tabelas
// públicas na própria página.
//
// Como não existe uma API oficial gratuita para esses dados, a técnica
// aqui é: buscar a página real e extrair as tabelas com o parser de HTML
// nativo do Cloudflare (HTMLRewriter) — mais robusto que expressões
// regulares para HTML de verdade.

const PRODUCT_SLUGS: Record<string, string> = {
  boi_gordo: 'boi-gordo',
  soja: 'soja',
  milho: 'milho',
  cafe: 'cafe',
  algodao: 'algodao',
  acucar: 'sucroenergetico',
  trigo: 'trigo',
  suinos: 'suinos',
  frango: 'frango',
  leite: 'leite',
};

interface ParsedTable {
  heading: string;
  source: string;
  rows: string[][];
}

class TableCollector {
  tables: ParsedTable[] = [];
  private currentHeading = '';
  private currentSource = '';
  private currentTable: string[][] | null = null;
  private currentRow: string[] | null = null;
  private currentCellText = '';
  private capturingHeading = false;

  onHeading = {
    element: (_el: any) => {
      this.capturingHeading = true;
      this.currentHeading = '';
    },
    text: (t: any) => {
      if (this.capturingHeading) this.currentHeading += t.text;
      if (t.lastInTextNode) this.capturingHeading = false;
    },
  };

  onParagraph = {
    text: (t: any) => {
      const text = t.text.trim();
      if (text.toLowerCase().startsWith('fonte:')) {
        this.currentSource = text.replace(/^fonte:\s*/i, '');
      }
    },
  };

  onTable = {
    element: (el: any) => {
      this.currentTable = [];
      el.onEndTag(() => {
        if (this.currentTable && this.currentTable.length > 0) {
          this.tables.push({
            heading: this.currentHeading.trim(),
            source: this.currentSource.trim(),
            rows: this.currentTable,
          });
        }
        this.currentTable = null;
        this.currentSource = '';
      });
    },
  };

  onRow = {
    element: (el: any) => {
      if (this.currentTable === null) return;
      this.currentRow = [];
      el.onEndTag(() => {
        if (this.currentRow && this.currentTable) {
          this.currentTable.push(this.currentRow);
        }
        this.currentRow = null;
      });
    },
  };

  onCell = {
    element: (el: any) => {
      if (this.currentRow === null) return;
      this.currentCellText = '';
      el.onEndTag(() => {
        if (this.currentRow) this.currentRow.push(this.currentCellText.trim());
      });
    },
    text: (t: any) => {
      this.currentCellText += t.text;
    },
  };
}

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const productKey = url.searchParams.get('produto') || 'boi_gordo';
    const slug = PRODUCT_SLUGS[productKey];

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Produto não reconhecido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sourceUrl = `https://www.noticiasagricolas.com.br/cotacoes/${slug}`;
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgroGestaoBot/1.0)' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar cotações (${res.status}).`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const collector = new TableCollector();
    const rewriter = new HTMLRewriter()
      .on('h2', collector.onHeading)
      .on('p', collector.onParagraph)
      .on('table', collector.onTable)
      .on('tr', collector.onRow)
      .on('td', collector.onCell)
      .on('th', collector.onCell);

    const transformed = rewriter.transform(res);
    await transformed.text();

    return new Response(JSON.stringify({
      produto: productKey,
      sourceUrl,
      tables: collector.tables,
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (error: any) {
    console.error('cotacoes error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar cotações: ' + (error.message || String(error)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
