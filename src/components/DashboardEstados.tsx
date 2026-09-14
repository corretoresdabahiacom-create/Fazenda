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

import { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Edit3, Plus, X, Save, Trash2 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFirebase } from '../contexts/FirebaseContext';
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

const ICONES_DISPONIVEIS = [
  '🐂', '🐄', '🐮', '🐷', '🐑', '🐐', '🐔', '🌱', '🌾', '🌽', '🌿',
  '☕', '🍇', '🍊', '🥛', '🧀', '🥚', '🍯', '📦',
];

// Formulário de administração, embutido direto no card do estado — só
// aparece pra quem é Admin. Cria/edita/exclui produto + preço +
// localização (praça/cidade) do estado deste card, tudo de uma vez,
// nas mesmas coleções que o Painel Admin usa (mesmo dado, dois
// lugares de acesso).
interface FormularioAdminEstado {
  precoId: string | null; // null = novo lançamento
  produtoNome: string;
  icone: string;
  praca: string;
  preco: string;
  unidade: string;
  prazoDias: number;
  tipoNegocio: 'SIF' | 'FOB' | 'nao_informado';
}

function vazio(): FormularioAdminEstado {
  return { precoId: null, produtoNome: '', icone: '📦', praca: '', preco: '', unidade: 'R$/@', prazoDias: 0, tipoNegocio: 'nao_informado' };
}

function PainelAdminDoEstado({ estadoNome, itensManuais, abrirComProduto, emailLogado, emailEhAdmin, onFechar }: {
  estadoNome: string;
  itensManuais: { precoId: string; produtoId: string; produtoNome: string; icone: string; localizacaoId: string; praca: string; preco: number; unidade: string; prazoDias: number; tipoNegocio: string }[];
  abrirComProduto?: any;
  emailLogado?: string | null;
  emailEhAdmin?: boolean;
  onFechar: () => void;
}) {
  const [form, setForm] = useState<FormularioAdminEstado>(vazio());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Se veio um produto específico pra editar/preencher (clicou no
  // lápis do produto na lista, não no botão geral "Admin"), já abre o
  // formulário certo, pré-preenchido.
  useEffect(() => {
    if (!abrirComProduto) return;
    if (abrirComProduto.precoId) {
      // Editando um lançamento manual já existente
      setForm({
        precoId: abrirComProduto.precoId, produtoNome: abrirComProduto.produtoNome, icone: abrirComProduto.icone,
        praca: abrirComProduto.praca, preco: String(abrirComProduto.preco), unidade: abrirComProduto.unidade,
        prazoDias: abrirComProduto.prazoDias, tipoNegocio: abrirComProduto.tipoNegocio,
      });
    } else if (abrirComProduto.produtoNomeSugerido) {
      // Produto automático sem cadastro manual ainda — só sugere o nome
      setForm({ ...vazio(), produtoNome: abrirComProduto.produtoNomeSugerido });
    }
    setMostrarForm(true);
  }, [abrirComProduto]);

  async function salvar() {
    if (!form.produtoNome.trim() || !form.praca.trim() || !form.preco) {
      alert('Preencha produto, praça/cidade e preço.');
      return;
    }
    setSalvando(true);
    try {
      const produtoId = `prod_${form.produtoNome.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      await setDoc(doc(db, 'cotacoesManuais_produtos', produtoId), {
        nome: form.produtoNome.trim(),
        categoria: 'Pecuária',
        icone: form.icone,
      }, { merge: true });

      const localizacaoId = `loc_${estadoNome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${form.praca.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      await setDoc(doc(db, 'cotacoesManuais_localizacoes', localizacaoId), {
        pais: 'Brasil', estado: estadoNome, local: form.praca.trim(), tipoLocal: 'cidade',
      }, { merge: true });

      const precoId = form.precoId || `preco_${Date.now()}`;
      const agora = new Date().toISOString();
      const dadosPreco: any = {
        produtoId, localizacaoId,
        preco: Number(form.preco), unidade: form.unidade, prazoDias: form.prazoDias, tipoNegocio: form.tipoNegocio,
        dataCotacao: agora.slice(0, 10), atualizadoEm: agora,
      };
      // Bug real corrigido: "criadoEm: undefined" (ao editar) faz o
      // Firestore rejeitar o setDoc inteiro — ele nunca aceita
      // "undefined" como valor de campo. Em vez de mandar o campo com
      // undefined, só inclui "criadoEm" quando for realmente um
      // lançamento novo.
      if (!form.precoId) dadosPreco.criadoEm = agora;
      await setDoc(doc(db, 'cotacoesManuais_precos', precoId), dadosPreco, { merge: true });

      setForm(vazio());
      setMostrarForm(false);
    } catch (erro: any) {
      console.error('Falha ao salvar cotação manual do estado:', erro);
      // Mostra a mensagem real do Firestore (ex: permissão negada) em
      // vez de um "tente de novo" genérico que não ajuda a diagnosticar.
      alert('Não foi possível salvar: ' + (erro?.message || String(erro)));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(precoId: string) {
    if (!confirm('Excluir esse preço?')) return;
    await deleteDoc(doc(db, 'cotacoesManuais_precos', precoId));
  }

  function abrirEdicao(item: typeof itensManuais[number]) {
    setForm({
      precoId: item.precoId, produtoNome: item.produtoNome, icone: item.icone, praca: item.praca,
      preco: String(item.preco), unidade: item.unidade, prazoDias: item.prazoDias,
      tipoNegocio: item.tipoNegocio as FormularioAdminEstado['tipoNegocio'],
    });
    setMostrarForm(true);
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">🔧 Edição (só Admin) — {estadoNome}</p>
        <button onClick={onFechar} className="text-amber-700 dark:text-amber-400"><X size={14} /></button>
      </div>

      {/* Diagnóstico de permissão: mostra com QUAL e-mail o app está
          logado e se ele bate com a lista de administradores das regras
          do Firestore. Sem isso, um erro de permissão só aparece depois
          de preencher o formulário todo, sem dizer o motivo. */}
      <p className="text-[10px] text-amber-700 dark:text-amber-400 border-t border-amber-300 dark:border-amber-800 pt-1.5">
        Logado como <strong>{emailLogado || '(sem e-mail)'}</strong> — {emailEhAdmin
          ? 'autorizado a salvar ✅'
          : 'NÃO está na lista de administradores das regras do Firestore, então o salvamento será recusado ❌'}
      </p>

      {itensManuais.length > 0 && (
        <div className="space-y-1">
          {itensManuais.map(item => (
            <div key={item.precoId} className="flex items-center justify-between bg-theme-card rounded-lg p-2 text-xs">
              <span>{item.icone} {item.produtoNome} — {item.praca}: <strong>R$ {item.preco.toFixed(2)}</strong> {item.unidade} ({item.prazoDias === 0 ? 'à vista' : `${item.prazoDias}d`}{item.tipoNegocio !== 'nao_informado' ? `, ${item.tipoNegocio}` : ''})</span>
              <div className="flex gap-1 shrink-0 ml-2">
                <button onClick={() => abrirEdicao(item)} className="p-1 hover:bg-theme-secondary rounded"><Edit3 size={12} /></button>
                <button onClick={() => excluir(item.precoId)} className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 rounded"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!mostrarForm ? (
        <button onClick={() => { setForm(vazio()); setMostrarForm(true); }} className="btn-primary text-xs px-3 py-1.5 w-full">
          <Plus size={12} /> Adicionar produto/preço nesse estado
        </button>
      ) : (
        <div className="bg-theme-card rounded-xl p-3 space-y-2">
          <input value={form.produtoNome} onChange={e => setForm({ ...form, produtoNome: e.target.value })} placeholder="Nome do produto (ex: Boi Gordo)" className="w-full px-3 py-1.5 text-xs border border-theme rounded-lg bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
          <div className="flex flex-wrap gap-1">
            {ICONES_DISPONIVEIS.map(ic => (
              <button key={ic} type="button" onClick={() => setForm({ ...form, icone: ic })} className={`w-7 h-7 rounded flex items-center justify-center text-sm ${form.icone === ic ? 'bg-[var(--primary)]/20 ring-1 ring-[var(--primary)]' : 'bg-theme-secondary'}`}>{ic}</button>
            ))}
          </div>
          <input value={form.praca} onChange={e => setForm({ ...form, praca: e.target.value })} placeholder={`Praça/Cidade em ${estadoNome} (ex: Feira de Santana)`} className="w-full px-3 py-1.5 text-xs border border-theme rounded-lg bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} placeholder="Preço (R$)" className="px-3 py-1.5 text-xs border border-theme rounded-lg bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
            <select value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} className="px-3 py-1.5 text-xs border border-theme rounded-lg bg-theme-card text-theme-primary">
              {['R$/@', 'R$/kg', 'R$/cabeça', 'R$/sc 60kg', 'R$/sc 50kg', 'R$/ton', 'R$/litro'].map(u => (
                <option key={u} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{u}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.prazoDias} onChange={e => setForm({ ...form, prazoDias: Number(e.target.value) })} placeholder="Prazo (dias, 0=à vista)" className="px-3 py-1.5 text-xs border border-theme rounded-lg bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
            <select value={form.tipoNegocio} onChange={e => setForm({ ...form, tipoNegocio: e.target.value as any })} className="px-3 py-1.5 text-xs border border-theme rounded-lg bg-theme-card text-theme-primary">
              <option value="nao_informado" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>Não informa</option>
              <option value="SIF" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>SIF</option>
              <option value="FOB" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>FOB</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMostrarForm(false)} className="flex-1 py-1.5 text-xs rounded-lg border border-theme text-theme-secondary">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary flex-1 text-xs py-1.5"><Save size={12} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
function DetalheProduto({ produtoId, produtoLabel, estado, itensManuaisDoProduto }: {
  produtoId: string; produtoLabel: string; estado: string;
  itensManuaisDoProduto?: { praca: string; preco: number; unidade: string }[];
}) {
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

  // Preços lançados pelo Admin entram na MESMA tabela do produto,
  // sempre no topo, identificados como "Pesquisa in loco" — junto com
  // os preços automáticos, não separado em outro lugar.
  const linhasManuais = (itensManuaisDoProduto || []).map(item => ({
    marketPlace: item.praca, price: item.preco, unit: item.unidade, source: 'Pesquisa in loco', __manual: true,
  }));
  const todasLinhas = [...linhasManuais, ...quotes];

  if (loading) return <p className="text-xs text-theme-secondary p-3">Buscando preço real...</p>;
  if (todasLinhas.length === 0) return <p className="text-xs text-theme-secondary p-3 italic">Sem detalhe por praça/cidade disponível pra {produtoLabel} em {estado} no momento.</p>;

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
          {todasLinhas.map((q, i) => (
            <tr key={i} className={`border-b border-theme last:border-0 ${(q as any).__manual ? 'bg-[var(--primary)]/5' : ''}`}>
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
  // BUG REAL CORRIGIDO: antes usava "userRole === 'admin'", mas TODO
  // usuário recebe role 'admin' no próprio cadastro (é o dono da
  // própria fazenda) — então o botão de Admin aparecia pra todo mundo,
  // e quem clicasse levava "Missing or insufficient permissions",
  // porque as regras do Firestore usam outro critério. Agora usa
  // exatamente o MESMO critério das regras: o e-mail de administrador
  // do sistema. Se essa lista mudar, tem que mudar nos dois lugares
  // (aqui e em firestore.rules → isBootstrapAdminEmail).
  const { user } = useFirebase();
  const EMAILS_ADMIN_SISTEMA = ['admin@fazenda.com.br', 'admmeuarmazem@gmail.com', 'arnaldolima.adv79@gmail.com'];
  const isAdmin = !!user?.email && EMAILS_ADMIN_SISTEMA.includes(user.email.toLowerCase());
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoEncontrado[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [produtoAberto, setProdutoAberto] = useState<string | null>(null);
  const [precosManuaisEstado, setPrecosManuaisEstado] = useState<ProdutoEncontrado[]>([]);
  const [itensManuaisDetalhados, setItensManuaisDetalhados] = useState<any[]>([]);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [produtoParaEditar, setProdutoParaEditar] = useState<any>(null);

  // Cotações manuais (Admin) — busca direto do Firestore, mesmo padrão
  // já usado no Painel Admin, filtradas pro estado deste card. Guarda
  // tanto a versão resumida (pra lista de produtos) quanto a completa
  // (pra edição do Admin, com id de cada peça pra poder editar/excluir).
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;

    // Bug real corrigido: antes isso era onSnapshot dentro de
    // onSnapshot dentro de onSnapshot (3 níveis), guardando só a
    // função de cancelar do mais externo — os listeners internos
    // ficavam se acumulando a cada atualização, sem nunca serem
    // desligados de verdade. Agora: produtos e localizações mudam
    // raramente, então busca uma vez só (getDocs); só o preço (que o
    // Admin pode alterar a qualquer momento) usa onSnapshot de verdade,
    // um nível só, fácil de cancelar.
    async function carregarEEscutar() {
      const [locSnap, produtoSnap] = await Promise.all([
        getDocs(collection(db, 'cotacoesManuais_localizacoes')),
        getDocs(collection(db, 'cotacoesManuais_produtos')),
      ]);
      if (cancelado) return;

      const locaisDoEstado = new Map(
        locSnap.docs
          .map(d => ({ id: d.id, ...d.data() as any }))
          .filter(l => l.estado === estado.nome)
          .map(l => [l.id, l])
      );
      const produtosPorId = new Map(produtoSnap.docs.map(d => [d.id, d.data() as any]));

      const unsubPrecos = onSnapshot(collection(db, 'cotacoesManuais_precos'), precoSnap => {
        const encontrados = new Map<string, ProdutoEncontrado>();
        const detalhados: any[] = [];
        precoSnap.docs.forEach(d => {
          const p = d.data() as any;
          const local = locaisDoEstado.get(p.localizacaoId);
          if (local) {
            const produto = produtosPorId.get(p.produtoId);
            if (produto) {
              encontrados.set(p.produtoId, { id: `manual_${p.produtoId}`, label: produto.nome, icone: produto.icone || '📦' });
              detalhados.push({
                precoId: d.id, produtoId: p.produtoId, produtoNome: produto.nome, icone: produto.icone || '📦',
                localizacaoId: p.localizacaoId, praca: local.local, preco: p.preco, unidade: p.unidade,
                prazoDias: p.prazoDias, tipoNegocio: p.tipoNegocio,
              });
            }
          }
        });
        setPrecosManuaisEstado(Array.from(encontrados.values()));
        setItensManuaisDetalhados(detalhados);
      }, erro => {
        console.error('Falha ao escutar cotacoesManuais_precos:', erro);
      });

      unsubscribeRef.current = unsubPrecos;
    }

    carregarEEscutar();
    return () => {
      cancelado = true;
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
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

  // Um produto pode ter fonte automática E lançamento manual do Admin
  // ao mesmo tempo — nesse caso aparece só UMA vez na lista (a versão
  // automática, se existir), já que o detalhe (DetalheProduto) já junta
  // as duas fontes na mesma tabela de qualquer forma.
  const idsAutomaticos = new Set((produtos || []).map(p => p.id));
  const manuaisSemDuplicar = precosManuaisEstado.filter(p => !idsAutomaticos.has(p.id.replace('manual_', '')));
  const todosProdutos = [...(produtos || []), ...manuaisSemDuplicar];

  return (
    <div className="bg-theme-card rounded-2xl border border-theme shadow-theme overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 p-3.5 text-left">
        {aberto ? <ChevronDown size={16} className="text-theme-secondary shrink-0" /> : <ChevronRight size={16} className="text-theme-secondary shrink-0" />}
        <SeloEstado uf={estado.uf} cor={estado.cor} />
        <span className="font-bold text-theme-primary flex-1">{estado.nome}</span>
        {isAdmin && aberto && (
          <button
            onClick={(e) => { e.stopPropagation(); setMostrarAdmin(!mostrarAdmin); }}
            className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border ${mostrarAdmin ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'text-[var(--primary)] border-[var(--primary)]/30'}`}
          >
            <Edit3 size={11} /> Admin
          </button>
        )}
      </button>

      {aberto && (
        <div className="px-3.5 pb-3.5 space-y-1.5">
          {isAdmin && mostrarAdmin && (
            <PainelAdminDoEstado
              estadoNome={estado.nome}
              itensManuais={itensManuaisDetalhados}
              abrirComProduto={produtoParaEditar}
              emailLogado={user?.email}
              emailEhAdmin={isAdmin}
              onFechar={() => { setMostrarAdmin(false); setProdutoParaEditar(null); }}
            />
          )}
          {loading && <p className="text-xs text-theme-secondary py-2">Verificando produtos disponíveis...</p>}
          {!loading && todosProdutos.length === 0 && (
            <p className="text-xs text-theme-secondary italic py-2">Nenhum produto com dado real disponível pra {estado.nome} ainda.{isAdmin ? ' Use o botão "Admin" acima pra cadastrar.' : ''}</p>
          )}
          {!loading && todosProdutos.map(p => {
            const itemManualDoProduto = itensManuaisDetalhados.find(item => `manual_${item.produtoId}` === p.id);
            return (
            <div key={p.id} className="border border-theme rounded-xl overflow-hidden">
              <div className="w-full flex items-center gap-2 p-2.5 bg-theme-secondary">
                <button onClick={() => setProdutoAberto(produtoAberto === p.id ? null : p.id)} className="flex items-center gap-2 flex-1 text-left">
                  <span className="text-lg">{p.icone}</span>
                  <span className="text-sm font-semibold text-theme-primary flex-1">{p.label}</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { setProdutoParaEditar(itemManualDoProduto ? { ...itemManualDoProduto } : { produtoNomeSugerido: p.label }); setMostrarAdmin(true); }}
                    className="p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary)]/10"
                    title={itemManualDoProduto ? 'Editar esse preço' : `Adicionar preço manual pra ${p.label}`}
                  >
                    <Edit3 size={13} />
                  </button>
                )}
                <button onClick={() => setProdutoAberto(produtoAberto === p.id ? null : p.id)}>
                  {produtoAberto === p.id ? <ChevronDown size={14} className="text-theme-secondary" /> : <ChevronRight size={14} className="text-theme-secondary" />}
                </button>
              </div>
              {produtoAberto === p.id && (
                <DetalheProduto
                  produtoId={p.id.replace('manual_', '')}
                  produtoLabel={p.label}
                  estado={estado.nome}
                  itensManuaisDoProduto={itensManuaisDetalhados.filter(item => item.produtoId === p.id.replace('manual_', ''))}
                />
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardEstados() {
  // DIAGNÓSTICO TEMPORÁRIO DE PERMISSÃO — a lista de administradores
  // fica em DOIS lugares que precisam bater exatamente: aqui no app e
  // em firestore.rules (função isBootstrapAdminEmail). Se o e-mail
  // logado não estiver nos dois, o salvamento é recusado pelo servidor
  // com "Missing or insufficient permissions". Esta linha mostra qual
  // e-mail o app está usando de verdade, pra não precisar adivinhar.
  // Pode ser removida depois que a permissão estiver confirmada.
  const { user } = useFirebase();
  const EMAILS_ADMIN = ['admin@fazenda.com.br', 'admmeuarmazem@gmail.com', 'arnaldolima.adv79@gmail.com'];
  const emailLogado = user?.email || null;
  const ehAdmin = !!emailLogado && EMAILS_ADMIN.includes(emailLogado.toLowerCase());

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-theme-primary">🗺️ Cotações por Estado</h2>
      <p className="text-[10px] text-theme-secondary">
        Clique num estado pra ver os produtos com dado real disponível. Clique num produto pra ver o preço por praça, região ou cidade. Estados sem nenhum produto real aparecem como "sem dado disponível" — nunca inventamos um número. Administradores veem um botão "Admin" pra cadastrar preço direto em qualquer estado.
      </p>
      <p className={`text-[10px] rounded-lg px-2 py-1 ${ehAdmin ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30' : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30'}`}>
        Sessão: <strong>{emailLogado || '(sem e-mail)'}</strong> — {ehAdmin
          ? 'na lista de administradores, pode cadastrar preços.'
          : 'fora da lista de administradores das regras do Firestore. O botão "Admin" não aparece e o salvamento seria recusado pelo servidor.'}
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
