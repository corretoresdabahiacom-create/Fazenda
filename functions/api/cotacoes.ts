// Busca cotações reais de produtos agropecuários (à vista/CEPEA, futuro/B3
// e preços regionais) a partir do noticiasagricolas.com.br — que consolida
// dados de CEPEA/ESALQ, B3, Scot Consultoria, Datagro e IMEA em tabelas
// públicas na própria página.
//
// Como não existe uma API oficial gratuita para esses dados, a técnica
// aqui é: buscar a página real e extrair as tabelas com o parser de HTML
// nativo do Cloudflare (HTMLRewriter). O título de cada tabela é
// capturado de forma "agnóstica" — não presumimos uma tag específica
// (h2, h3 etc.), e sim usamos o texto curto mais recente visto em
// qualquer um dos elementos comuns de título (h1-h6, strong, b) logo
// antes de cada <table> — mais resistente a mudanças de estrutura do
// site do que depender de uma tag fixa.

const PRODUCT_SLUGS: Record<string, string> = {
  boi_gordo: 'boi-gordo',
  cafe: 'cafe',
  algodao: 'algodao',
  soja: 'soja',
  milho: 'milho',
  trigo: 'trigo',
  laranja: 'laranja',
  acucar: 'sucroenergetico',
  suinos: 'suinos',
  frango: 'frango',
  leite: 'leite',
  arroz: 'arroz',
  feijao: 'feijao',
  cacau: 'cacau',
  amendoim: 'amendoim',
  sorgo: 'sorgo',
  ovos: 'ovos',
  mandioca: 'mandioca',
  frutas: 'frutas',
};

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b'];

interface ParsedTable {
  heading: string;
  source: string;
  rows: string[][];
}

class TableCollector {
  tables: ParsedTable[] = [];
  private lastHeadingCandidate = '';
  private currentSource = '';
  private currentTable: string[][] | null = null;
  private currentRow: string[] | null = null;
  private currentCellText = '';
  private headingBuffers = new Map<string, string>();
  private insideTable = false;

  registerHeadingHandlers(rewriter: HTMLRewriter) {
    for (const tag of HEADING_TAGS) {
      rewriter.on(tag, {
        element: (el: any) => {
          if (this.insideTable) return;
          const id = `${tag}-${Math.random()}`;
          this.headingBuffers.set(id, '');
          el.onEndTag(() => {
            const text = (this.headingBuffers.get(id) || '').trim();
            this.headingBuffers.delete(id);
            if (text && text.length <= 140) {
              this.lastHeadingCandidate = text;
            }
          });
        },
        text: (t: any) => {
          const keys = Array.from(this.headingBuffers.keys()).filter(k => k.startsWith(tag + '-'));
          const lastKey = keys[keys.length - 1];
          if (lastKey) {
            this.headingBuffers.set(lastKey, (this.headingBuffers.get(lastKey) || '') + t.text);
          }
        },
      });
    }
  }

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
      this.insideTable = true;
      const headingForThisTable = this.lastHeadingCandidate;
      this.currentTable = [];
      el.onEndTag(() => {
        if (this.currentTable && this.currentTable.length > 0) {
          this.tables.push({
            heading: headingForThisTable,
            source: this.currentSource.trim(),
            rows: this.currentTable,
          });
        }
        this.currentTable = null;
        this.currentSource = '';
        this.insideTable = false;
        this.lastHeadingCandidate = '';
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Falha ao buscar cotações (status ${res.status}): ${bodyText.slice(0, 200)}`, sourceUrl }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const collector = new TableCollector();
    const rewriter = new HTMLRewriter()
      .on('p', collector.onParagraph)
      .on('table', collector.onTable)
      .on('tr', collector.onRow)
      .on('td', collector.onCell)
      .on('th', collector.onCell);
    collector.registerHeadingHandlers(rewriter);

    const transformed = rewriter.transform(res);
    await transformed.text();

    const cleanTables = collector.tables.filter(t => t.rows.length > 0 && (t.rows[0]?.length || 0) >= 2);

    return new Response(JSON.stringify({
      produto: productKey,
      sourceUrl,
      tables: cleanTables,
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
