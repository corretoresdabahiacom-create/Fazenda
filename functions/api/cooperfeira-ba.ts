// Busca a cotação do boi gordo em FEIRA DE SANTANA (BA), divulgada
// semanalmente pela COOPERFEIRA — Cooperativa Pecuária de Feira de
// Santana, que administra o frigorífico Frifeira. É a referência real
// da praça: os valores vêm de negócios de compradores que abatem no
// Frifeira.
//
// DESAFIO: a Cooperfeira não tem site próprio publicando a cotação. Os
// números saem em notícias de portais locais (Jornal Grande Bahia,
// Grupo Lomes), cada semana numa URL diferente, com o valor escrito em
// texto corrido de jornalista — formato que varia muito ("cotada a
// R$ 340", "fechou a R$ 340,00", "permanece em R$ 340").
//
// SOLUÇÃO: usamos IA (Gemini, com fallback pra outros modelos via
// aiClient) pra ler o texto da notícia mais recente e extrair o valor.
// Uma expressão regular quebraria com facilidade nessa variação toda;
// a IA lida bem com isso. IMPORTANTE: a IA aqui NÃO inventa preço —
// ela é instruída a devolver null se não achar o valor, e o resultado
// passa por validação de faixa antes de ser aceito.

import { generateText } from './aiClient';

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GROQ_API_KEY?: string;
  MISTRAL_API_KEY?: string;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Faixa de sanidade — rejeita qualquer valor absurdo que a IA
// eventualmente devolva por erro de leitura. Boi gordo fora de
// R$150–600/@ é quase certamente erro.
const MIN_PLAUSIVEL = 150;
const MAX_PLAUSIVEL = 600;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tenta primeiro uma extração simples por padrão de texto — se
// funcionar, nem gasta chamada de IA (mais rápido e sem custo).
function tentarExtracaoSimples(texto: string): { preco: number; metodo: string } | null {
  const padroes = [
    /arroba[^.]{0,80}?R\$\s*(\d{3})(?:,(\d{2}))?/i,
    /R\$\s*(\d{3})(?:,(\d{2}))?[^.]{0,60}?(?:por\s+)?arroba/i,
    /cotad[ao][^.]{0,40}?R\$\s*(\d{3})(?:,(\d{2}))?/i,
  ];
  for (const padrao of padroes) {
    const m = texto.match(padrao);
    if (m) {
      const valor = Number(`${m[1]}.${m[2] || '00'}`);
      if (valor >= MIN_PLAUSIVEL && valor <= MAX_PLAUSIVEL) {
        return { preco: valor, metodo: 'padrão de texto' };
      }
    }
  }
  return null;
}

async function extrairComIA(texto: string, env: Env): Promise<{ preco: number; metodo: string } | null> {
  const temAlgumaChave = env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.DEEPSEEK_API_KEY || env.GROQ_API_KEY || env.MISTRAL_API_KEY;
  if (!temAlgumaChave) return null;

  const trecho = texto.slice(0, 4000); // só o começo da notícia basta
  const prompt = `Você recebe o texto de uma notícia sobre o preço do boi gordo em Feira de Santana (Bahia), divulgado pela Cooperfeira.

Extraia APENAS o valor atual da arroba do boi gordo mencionado no texto.

REGRAS IMPORTANTES:
- Responda SOMENTE com JSON, sem nenhum texto antes ou depois, sem marcação de código.
- Formato exato: {"preco": 340.00} ou {"preco": null}
- Se o texto citar vários valores (ex: histórico, "era R$ 310 em janeiro"), devolva o valor ATUAL/mais recente, não os históricos.
- Se você NÃO tiver certeza de qual é o valor atual, devolva {"preco": null}. NUNCA invente ou estime um valor.

TEXTO DA NOTÍCIA:
${trecho}`;

  try {
    const resultado = await generateText(prompt, prompt, env as any);
    const preco = Number(resultado?.preco);
    if (!isNaN(preco) && preco >= MIN_PLAUSIVEL && preco <= MAX_PLAUSIVEL) {
      return { preco, metodo: 'IA' };
    }
  } catch (e) {
    console.error('Falha na extração por IA:', e);
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // Busca a notícia mais recente sobre a cotação da Cooperfeira no
    // Jornal Grande Bahia, que cobre a pauta com regularidade e tem
    // uma busca com URL previsível.
    const buscaUrl = 'https://jornalgrandebahia.com.br/?s=arroba+boi+gordo+Feira+de+Santana+Cooperfeira&orderby=date&order=DESC';
    const buscaRes = await fetch(buscaUrl, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } });

    if (!buscaRes.ok) {
      return new Response(JSON.stringify({ error: `Não foi possível buscar as notícias da Cooperfeira (status ${buscaRes.status}).`, sourceUrl: buscaUrl }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const buscaHtml = await buscaRes.text();
    // Pega o primeiro link de artigo que fale de arroba/boi gordo.
    const linkMatch = buscaHtml.match(/href="(https:\/\/jornalgrandebahia\.com\.br\/\d{4}\/\d{2}\/[^"]*(?:arroba|boi-gordo)[^"]*)"/i);
    const artigoUrl = linkMatch?.[1];

    if (!artigoUrl) {
      return new Response(JSON.stringify({ error: 'Nenhuma notícia recente sobre a cotação da Cooperfeira foi encontrada.', sourceUrl: buscaUrl }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const artigoRes = await fetch(artigoUrl, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } });
    if (!artigoRes.ok) {
      return new Response(JSON.stringify({ error: `Não foi possível abrir a notícia (status ${artigoRes.status}).`, sourceUrl: artigoUrl }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const artigoHtml = await artigoRes.text();
    const texto = stripTags(artigoHtml);

    // Data de publicação — tenta o metadado estruturado da página
    // primeiro (mais confiável), senão cai pro padrão /AAAA/MM/ da URL.
    const metaDateMatch = artigoHtml.match(/"datePublished"\s*:\s*"([^"]+)"/i);
    const urlDateMatch = artigoUrl.match(/\/(\d{4})\/(\d{2})\//);
    const dataPublicacao = metaDateMatch?.[1] || (urlDateMatch ? `${urlDateMatch[1]}-${urlDateMatch[2]}-01` : null);

    // BUG REAL EVITADO: a busca por relevância do portal pode trazer uma
    // notícia ANTIGA que bate bem com os termos, não necessariamente a
    // mais recente. Em vez de confiar cegamente, rejeitamos
    // explicitamente qualquer notícia com mais de 25 dias (a divulgação
    // é semanal, então isso dá uma margem generosa) — melhor avisar que
    // não achamos nada atual do que mostrar um preço de meses atrás como
    // se fosse de hoje.
    if (dataPublicacao) {
      const dataArtigo = new Date(dataPublicacao);
      const diasDesdePublicacao = (Date.now() - dataArtigo.getTime()) / (1000 * 60 * 60 * 24);
      if (!isNaN(diasDesdePublicacao) && diasDesdePublicacao > 25) {
        return new Response(JSON.stringify({
          error: `A notícia mais relevante encontrada é de ${dataArtigo.toLocaleDateString('pt-BR')} — velha demais pra mostrar como cotação atual (a Cooperfeira divulga semanalmente). Preferimos avisar isso a mostrar um preço desatualizado.`,
          sourceUrl: artigoUrl,
          dataEncontrada: dataPublicacao,
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 1ª tentativa: padrão de texto (rápido, sem custo de IA).
    let resultado = tentarExtracaoSimples(texto);
    // 2ª tentativa: IA, que lida melhor com a variação de escrita.
    if (!resultado) resultado = await extrairComIA(texto, context.env);

    if (!resultado) {
      return new Response(JSON.stringify({
        error: 'Notícia encontrada, mas não foi possível extrair o valor com confiança — preferimos não mostrar nada a mostrar um número incerto.',
        sourceUrl: artigoUrl,
        dica: 'Se as chaves de IA (GEMINI_API_KEY etc.) não estiverem configuradas no Cloudflare, só a extração por padrão de texto funciona, que é mais limitada.',
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      praca: 'Feira de Santana',
      estado: 'Bahia',
      preco: resultado.preco.toFixed(2).replace('.', ','),
      unidade: '@',
      metodoExtracao: resultado.metodo,
      dataPublicacao,
      sourceUrl: artigoUrl,
      fonteOriginal: 'Cooperfeira (Cooperativa Pecuária de Feira de Santana) / Frifeira, via Jornal Grande Bahia',
      aviso: 'Cotação divulgada semanalmente pela Cooperfeira, com base em negócios de compradores que abatem no Frifeira — é referência regional e pode oscilar no dia a dia.',
      fetchedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=10800' },
    });
  } catch (error: any) {
    console.error('cooperfeira error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao buscar cotação da Cooperfeira: ' + (error.message || String(error)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
