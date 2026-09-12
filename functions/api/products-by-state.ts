// Descobre quais produtos têm cotação REAL disponível pra um estado
// específico — usado pra montar a lista de produtos dentro de cada
// dashboard de estado em Cotações, sem nunca inventar um produto que
// não tenha dado de verdade por trás.
//
// Verifica, na ordem: cotações manuais (Admin), Scot por praça (boi
// gordo/vaca, 20 estados), Datagro via Giro do Boi (boi gordo, 10
// estados), IEA-SP (só SP), Incaper (só ES), Epagri (só SC), AIBA (só
// Bahia, grãos).

import { firestoreGetDoc, GoogleServiceAccountEnv } from './_googleAuth';

interface Env extends GoogleServiceAccountEnv {}

const PRODUTO_ICONE: Record<string, { label: string; icone: string }> = {
  boi_gordo: { label: 'Boi Gordo', icone: '🐂' },
  vaca: { label: 'Vaca', icone: '🐄' },
  novilho: { label: 'Novilho/Garrote', icone: '🐂' },
  novilha: { label: 'Novilha', icone: '🐂' },
  bezerro: { label: 'Bezerro', icone: '🐮' },
  bezerra: { label: 'Bezerra', icone: '🐮' },
  soja: { label: 'Soja', icone: '🌱' },
  milho: { label: 'Milho', icone: '🌽' },
  sorgo: { label: 'Sorgo', icone: '🌾' },
  algodao: { label: 'Algodão', icone: '🌿' },
  cafe: { label: 'Café', icone: '☕' },
  arroz: { label: 'Arroz', icone: '🌾' },
  feijao: { label: 'Feijão', icone: '🫘' },
};

async function fetchJson(origin: string, path: string): Promise<any | null> {
  try {
    const res = await fetch(`${origin}${path}`);
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.error ? null : json;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const origin = url.origin;
    const estado = url.searchParams.get('estado') || '';
    if (!estado) {
      return new Response(JSON.stringify({ error: 'Informe o parâmetro "estado".' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const produtosEncontrados = new Set<string>();

    // Cotações manuais (Admin) são verificadas separadamente no
    // frontend (via Firestore direto, mesmo padrão do Painel Admin) —
    // não duplicamos aqui pra não precisar de um endpoint extra só pra
    // listar coleção, que ainda não existe nesse projeto.
    // 2. Scot por praça — Boi Gordo e Vaca, 20 estados.
    const scotData = await fetchJson(origin, '/api/scot-pracas');
    if (scotData?.pracas?.some((p: any) => p.estado === estado)) {
      produtosEncontrados.add('boi_gordo');
      const pracasDoEstado = scotData.pracas.filter((p: any) => p.estado === estado);
      if (pracasDoEstado.some((p: any) => p.vacaGorda)) produtosEncontrados.add('vaca');
    }

    // Datagro via Giro do Boi — Boi Gordo, 10 estados.
    const datagroData = await fetchJson(origin, '/api/datagro-girodoboi');
    if (datagroData?.precos?.[estado]) produtosEncontrados.add('boi_gordo');

    // 4. IEA-SP — só São Paulo, vários produtos.
    if (estado === 'São Paulo') {
      const ieaData = await fetchJson(origin, '/api/iea-sp');
      for (const row of (ieaData?.recebidosPelosProdutores || [])) {
        const nome = String(row.produto || '').toLowerCase();
        if (/boi gordo(?!\s*\(china\))/.test(nome)) produtosEncontrados.add('boi_gordo');
        else if (/vaca gorda/.test(nome)) produtosEncontrados.add('vaca');
        else if (/garrote|novilho/.test(nome)) produtosEncontrados.add('novilho');
        else if (/novilha/.test(nome)) produtosEncontrados.add('novilha');
        else if (/^milho$/.test(nome)) produtosEncontrados.add('milho');
        else if (/^soja$/.test(nome)) produtosEncontrados.add('soja');
      }
    }

    // 5. Incaper — só Espírito Santo.
    if (estado === 'Espírito Santo') {
      const incaperData = await fetchJson(origin, '/api/incaper-es');
      for (const row of (incaperData?.precos || [])) {
        const nome = String(row.produto || '').toLowerCase();
        if (/boi gordo/.test(nome)) produtosEncontrados.add('boi_gordo');
        else if (/vaca gorda/.test(nome)) produtosEncontrados.add('vaca');
      }
    }

    // 6. Epagri — só Santa Catarina.
    if (estado === 'Santa Catarina') {
      const epagriData = await fetchJson(origin, '/api/epagri-sc');
      if (epagriData?.boiGordo) produtosEncontrados.add('boi_gordo');
      if (epagriData?.vacaGorda) produtosEncontrados.add('vaca');
    }

    // 7. AIBA — só Bahia, grãos.
    if (estado === 'Bahia') {
      const aibaData = await fetchJson(origin, '/api/aiba-ba');
      for (const row of (aibaData?.rows || [])) {
        const nome = String(row.produto || '').toLowerCase();
        if (/soja/.test(nome)) produtosEncontrados.add('soja');
        else if (/^milho$/.test(nome)) produtosEncontrados.add('milho');
        else if (/sorgo/.test(nome)) produtosEncontrados.add('sorgo');
        else if (/algod[ãa]o/.test(nome)) produtosEncontrados.add('algodao');
        else if (/caf[ée]/.test(nome)) produtosEncontrados.add('cafe');
        else if (/feij[ãa]o/.test(nome)) produtosEncontrados.add('feijao');
        else if (/arroz/.test(nome)) produtosEncontrados.add('arroz');
      }
    }

    const produtos = Array.from(produtosEncontrados).map(id => {
      const info = PRODUTO_ICONE[id] || { label: id, icone: '📦' };
      return { id, label: info.label, icone: info.icone };
    });

    return new Response(JSON.stringify({ estado, produtos, total: produtos.length }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
  } catch (error: any) {
    console.error('products-by-state error:', error);
    return new Response(JSON.stringify({ error: 'Falha ao verificar produtos: ' + (error.message || String(error)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
