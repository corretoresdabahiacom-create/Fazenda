/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dashboard recolhido de todos os 26 estados + Distrito Federal, cada
// um mostrando os produtos com dado REAL disponível (sem preço na
// lista recolhida) — clicar num produto expande o detalhe por
// praça/região/cidade daquele estado.
//
// SOBRE AS "BANDEIRAS": o Unicode não tem emoji de bandeira estadual
// brasileira (só bandeiras de país) — usamos um selo colorido com a
// sigla do estado como substituto honesto, documentado aqui pra não
// passar a impressão de que existe uma bandeira de verdade sendo usada.

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Edit3 } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/bandeirasEstados.css';

const ESTADOS_UF: { nome: string; uf: string; cor: string }[] = [
  { nome: 'Acre', uf: 'AC', cor: '#1a936f' },
  { nome: 'Alagoas', uf: 'AL', cor: '#0f8b8d' },
  { nome: 'Amapá', uf: 'AP', cor: '#114b5f' },
  { nome: 'Amazonas', uf: 'AM', cor: '#088714' },
  { nome: 'Bahia', uf: 'BA', cor: '#c1121f' },
  { nome: 'Ceará', uf: 'CE', cor: '#e09f3e' },
  { nome: 'Distrito Federal', uf: 'DF', cor: '#3a5a40' },
  { nome: 'Espírito Santo', uf: 'ES', cor: '#0077b6' },
  { nome: 'Goiás', uf: 'GO', cor: '#588157' },
  { nome: 'Maranhão', uf: 'MA', cor: '#003049' },
  { nome: 'Mato Grosso', uf: 'MT', cor: '#606c38' },
  { nome: 'Mato Grosso do Sul', uf: 'MS', cor: '#283618' },
  { nome: 'Minas Gerais', uf: 'MG', cor: '#6a994e' },
  { nome: 'Pará', uf: 'PA', cor: '#1b4332' },
  { nome: 'Paraíba', uf: 'PB', cor: '#d62828' },
  { nome: 'Paraná', uf: 'PR', cor: '#0d3b66' },
  { nome: 'Pernambuco', uf: 'PE', cor: '#9d0208' },
  { nome: 'Piauí', uf: 'PI', cor: '#5f0f40' },
  { nome: 'Rio de Janeiro', uf: 'RJ', cor: '#1d3557' },
  { nome: 'Rio Grande do Norte', uf: 'RN', cor: '#2a9d8f' },
  { nome: 'Rio Grande do Sul', uf: 'RS', cor: '#3d5a80' },
  { nome: 'Rondônia', uf: 'RO', cor: '#606c38' },
  { nome: 'Roraima', uf: 'RR', cor: '#2b9348' },
  { nome: 'Santa Catarina', uf: 'SC', cor: '#023e8a' },
  { nome: 'São Paulo', uf: 'SP', cor: '#8d0801' },
  { nome: 'Sergipe', uf: 'SE', cor: '#087f5b' },
  { nome: 'Tocantins', uf: 'TO', cor: '#7f4f24' },
];

// Bandeira real do estado, em CSS puro (ver src/styles/bandeirasEstados.css
// pra saber quais são fiéis à fonte MIT original e quais são
// aproximação simplificada). Tamanho de ícone via escala do desenho
// original de 300x200.
const TAMANHO_ICONE = 28;
const ESCALA = TAMANHO_ICONE / 300;

function SeloEstado({ uf }: { uf: string; cor?: string }) {
  return (
    <span
      className="flag-icon-container shrink-0"
      style={{ width: TAMANHO_ICONE, height: TAMANHO_ICONE * (200 / 300) }}
    >
      <span
        className={`flag-icon-inner flag flag-${uf.toLowerCase()}`}
        style={{ transform: `scale(${ESCALA})` }}
      />
    </span>
  );
}

interface ProdutoEncontrado { id: string; label: string; icone: string }

// Detalhe de um produto — busca o preço real por praça/região/cidade
// daquele estado, usando o mesmo endpoint unificado já testado em
// Cotações.
function DetalheProduto({ produtoId, produtoLabel, estado }: { produtoId: string; produtoLabel: string; estado: string }) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/quotes?product=${produtoId}&state=${encodeURIComponent(estado)}`)
      .then(res => res.json())
      .then(json => setQuotes(json.quotes || []))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, [produtoId, estado]);

  if (loading) return <p className="text-xs text-theme-secondary p-3">Buscando preço real...</p>;
  if (quotes.length === 0) return <p className="text-xs text-theme-secondary p-3 italic">Sem detalhe por praça/cidade disponível pra {produtoLabel} em {estado} no momento.</p>;

  return (
    <div className="bg-theme-secondary rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-theme">
            <th className="text-left p-2 font-bold text-theme-secondary">Praça/Cidade/Região</th>
            <th className="text-left p-2 font-bold text-theme-secondary">Preço</th>
            <th className="text-left p-2 font-bold text-theme-secondary">Fonte</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q, i) => (
            <tr key={i} className="border-b border-theme last:border-0">
              <td className="p-2 text-theme-primary font-semibold">{q.marketPlace || q.municipality || q.region || estado}</td>
              <td className="p-2 text-theme-primary font-bold">R$ {q.price?.toFixed(2)} <span className="font-normal text-theme-secondary">{q.unit}</span></td>
              <td className="p-2 text-theme-secondary">{q.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Card de um estado — recolhido por padrão, busca a lista de produtos
// (sem preço) só quando expandido, pra não disparar 27 buscas de uma
// vez sem necessidade.
interface CardEstadoProps {
  estado: { nome: string; uf: string; cor: string };
}

function CardEstado({ estado }: CardEstadoProps) {
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoEncontrado[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [produtoAberto, setProdutoAberto] = useState<string | null>(null);
  const [precosManuaisEstado, setPrecosManuaisEstado] = useState<ProdutoEncontrado[]>([]);

  // Cotações manuais (Admin) — busca direto do Firestore, mesmo padrão
  // já usado no Painel Admin, filtradas pro estado deste card.
  useEffect(() => {
    if (!aberto) return;
    const unsubs = [
      onSnapshot(collection(db, 'cotacoesManuais_localizacoes'), locSnap => {
        const locais = locSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        const idsDoEstado = new Set(locais.filter(l => l.estado === estado.nome).map(l => l.id));
        onSnapshot(collection(db, 'cotacoesManuais_precos'), precoSnap => {
          onSnapshot(collection(db, 'cotacoesManuais_produtos'), produtoSnap => {
            const produtosPorId = new Map(produtoSnap.docs.map(d => [d.id, (d.data() as any).nome]));
            const encontrados = new Map<string, ProdutoEncontrado>();
            precoSnap.docs.forEach(d => {
              const p = d.data() as any;
              if (idsDoEstado.has(p.localizacaoId)) {
                const nome = produtosPorId.get(p.produtoId);
                if (nome) encontrados.set(p.produtoId, { id: `manual_${p.produtoId}`, label: nome, icone: '✍️' });
              }
            });
            setPrecosManuaisEstado(Array.from(encontrados.values()));
          });
        });
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [aberto, estado.nome]);

  function toggle() {
    const novoEstado = !aberto;
    setAberto(novoEstado);
    if (novoEstado && produtos === null) {
      setLoading(true);
      fetch(`/api/products-by-state?estado=${encodeURIComponent(estado.nome)}`)
        .then(res => res.json())
        .then(json => setProdutos(json.produtos || []))
        .catch(() => setProdutos([]))
        .finally(() => setLoading(false));
    }
  }

  const todosProdutos = [...(produtos || []), ...precosManuaisEstado];

  return (
    <div className="bg-theme-card rounded-2xl border border-theme shadow-theme overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-3.5 text-left">
        {aberto ? <ChevronDown size={16} className="text-theme-secondary shrink-0" /> : <ChevronRight size={16} className="text-theme-secondary shrink-0" />}
        <SeloEstado uf={estado.uf} cor={estado.cor} />
        <span className="font-bold text-theme-primary flex-1">{estado.nome}</span>
        {estado.nome === 'Bahia' && (
          <span className="text-[10px] font-bold text-[var(--primary)] flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--primary)]/30" title="Cadastre preço manual em: Painel Admin → Cotações Manuais">
            <Edit3 size={11} /> Editável (Admin)
          </span>
        )}
      </button>

      {aberto && (
        <div className="px-3.5 pb-3.5 space-y-1.5">
          {loading && <p className="text-xs text-theme-secondary py-2">Verificando produtos disponíveis...</p>}
          {!loading && todosProdutos.length === 0 && (
            <p className="text-xs text-theme-secondary italic py-2">Nenhum produto com dado real disponível pra {estado.nome} ainda.</p>
          )}
          {!loading && todosProdutos.map(p => (
            <div key={p.id} className="border border-theme rounded-xl overflow-hidden">
              <button
                onClick={() => setProdutoAberto(produtoAberto === p.id ? null : p.id)}
                className="w-full flex items-center gap-2 p-2.5 text-left bg-theme-secondary"
              >
                <span className="text-lg">{p.icone}</span>
                <span className="text-sm font-semibold text-theme-primary flex-1">{p.label}</span>
                {produtoAberto === p.id ? <ChevronDown size={14} className="text-theme-secondary" /> : <ChevronRight size={14} className="text-theme-secondary" />}
              </button>
              {produtoAberto === p.id && (
                <DetalheProduto produtoId={p.id.replace('manual_', '')} produtoLabel={p.label} estado={estado.nome} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardEstados() {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-theme-primary">🗺️ Cotações por Estado</h2>
      <p className="text-[10px] text-theme-secondary">
        Clique num estado pra ver os produtos com dado real disponível. Clique num produto pra ver o preço por praça, região ou cidade. Estados sem nenhum produto real aparecem como "sem dado disponível" — nunca inventamos um número. Bahia aceita cadastro manual pelo Painel Admin → Cotações Manuais.
      </p>
      <div className="space-y-2">
        {ESTADOS_UF.map(estado => (
          <div key={estado.uf}>
            <CardEstado estado={estado} />
          </div>
        ))}
      </div>
    </div>
  );
}
