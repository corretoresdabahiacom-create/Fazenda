/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Painel de Cotações Manuais — permite ao admin cadastrar produto,
// localização e preço manualmente, pra suprir a ausência de fontes
// automáticas (ex: SEAGRI-BA, que está com o sistema vazio no momento).
// Estrutura pensada pra virar uma fonte "manual" dentro do mesmo
// pipeline que já mostra Scot/Datagro/IEA-SP etc. em Cotações.

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Trash2, Edit3, X, Save } from 'lucide-react';

export interface ProdutoManual {
  id: string;
  nome: string;
  categoria: string; // "Pecuária", "Grãos", etc.
}

export interface LocalizacaoManual {
  id: string;
  pais: string;
  estado: string;
  local: string; // cidade, praça ou região — mesmo campo, o "tipo" abaixo esclarece qual é
  tipoLocal: 'cidade' | 'praca' | 'regiao';
}

export interface PrecoManual {
  id: string;
  produtoId: string;
  localizacaoId: string;
  preco: number;
  unidade: string; // "R$/@", "R$/kg", "R$/cabeça", "R$/sc 60kg" etc.
  prazoDias: number; // 0 = à vista
  tipoNegocio: 'SIF' | 'FOB' | 'nao_informado';
  dataCotacao: string; // ISO date
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
}

const PRODUTOS_PADRAO: Omit<ProdutoManual, 'id'>[] = [
  { nome: 'Boi Gordo', categoria: 'Pecuária' },
  { nome: 'Vaca', categoria: 'Pecuária' },
  { nome: 'Novilho', categoria: 'Pecuária' },
  { nome: 'Novilha', categoria: 'Pecuária' },
  { nome: 'Bezerro', categoria: 'Pecuária' },
  { nome: 'Bezerra', categoria: 'Pecuária' },
];

const UNIDADES_COMUNS = ['R$/@', 'R$/kg', 'R$/cabeça', 'R$/sc 60kg', 'R$/sc 50kg', 'R$/ton', 'R$/litro'];

function useFirestoreCollection<T extends { id: string }>(path: string): [T[], boolean] {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [path]);

  return [items, loading];
}

// ---------------------------------------------------------------------
// Aba LOCALIZAÇÃO (País > Estado > Cidade/Praça/Região)
// ---------------------------------------------------------------------
const ESTADOS_BR = [
  'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo',
  'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba',
  'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul',
  'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
];

function AbaLocalizacao({ localizacoes }: { localizacoes: LocalizacaoManual[] }) {
  const [editando, setEditando] = useState<LocalizacaoManual | null>(null);
  const [form, setForm] = useState({ pais: 'Brasil', estado: 'Bahia', local: '', tipoLocal: 'cidade' as LocalizacaoManual['tipoLocal'] });
  const [mostrarForm, setMostrarForm] = useState(false);

  async function salvar() {
    if (!form.local.trim()) return;
    const id = editando?.id || `loc_${Date.now()}`;
    await setDoc(doc(db, 'cotacoesManuais_localizacoes', id), form);
    setForm({ pais: 'Brasil', estado: 'Bahia', local: '', tipoLocal: 'cidade' });
    setEditando(null);
    setMostrarForm(false);
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta localização? Preços já cadastrados pra ela vão ficar órfãos.')) return;
    await deleteDoc(doc(db, 'cotacoesManuais_localizacoes', id));
  }

  function abrirEdicao(l: LocalizacaoManual) {
    setEditando(l);
    setForm({ pais: l.pais, estado: l.estado, local: l.local, tipoLocal: l.tipoLocal });
    setMostrarForm(true);
  }

  const TIPO_LABEL = { cidade: 'Cidade', praca: 'Praça', regiao: 'Região' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#3d5a45]">País / Estado / Cidade, Praça ou Região</h3>
        <button onClick={() => { setEditando(null); setForm({ pais: 'Brasil', estado: 'Bahia', local: '', tipoLocal: 'cidade' }); setMostrarForm(true); }} className="btn-primary text-xs px-3 py-2">
          <Plus size={14} /> Nova Localização
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-[#e5e0d8] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[#3d5a45]">{editando ? 'Editar localização' : 'Nova localização'}</p>
            <button onClick={() => setMostrarForm(false)}><X size={16} /></button>
          </div>
          <input value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })} placeholder="País" className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c]" />
          <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]">
            {ESTADOS_BR.map(e => <option key={e}>{e}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={form.tipoLocal} onChange={e => setForm({ ...form, tipoLocal: e.target.value as any })} className="px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]">
              <option value="cidade">Cidade</option>
              <option value="praca">Praça</option>
              <option value="regiao">Região</option>
            </select>
            <input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="Nome (ex: Feira de Santana, BA Oeste...)" className="flex-1 px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c]" />
          </div>
          <button onClick={salvar} className="btn-primary w-full"><Save size={14} /> Salvar</button>
        </div>
      )}

      <div className="bg-white border border-[#e5e0d8] rounded-2xl overflow-hidden">
        {localizacoes.length === 0 && <p className="p-4 text-sm text-[#6d6a66]">Nenhuma localização cadastrada ainda.</p>}
        {localizacoes.map(l => (
          <div key={l.id} className="flex items-center justify-between p-3 border-b border-[#e5e0d8] last:border-0">
            <div>
              <p className="font-semibold text-[#3d5a45]">{l.local} <span className="text-[10px] font-bold text-[#3d5a45]/70 bg-[#3d5a45]/10 px-1.5 py-0.5 rounded-full ml-1">{TIPO_LABEL[l.tipoLocal]}</span></p>
              <p className="text-xs text-[#6d6a66]">{l.estado} — {l.pais}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => abrirEdicao(l)} className="p-2 hover:bg-[#f5f2ed] text-[#6d6a66] rounded-xl"><Edit3 size={14} /></button>
              <button onClick={() => excluir(l.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------
function AbaProdutos({ produtos }: { produtos: ProdutoManual[] }) {
  const [editando, setEditando] = useState<ProdutoManual | null>(null);
  const [form, setForm] = useState({ nome: '', categoria: 'Pecuária' });
  const [mostrarForm, setMostrarForm] = useState(false);

  async function salvar() {
    if (!form.nome.trim()) return;
    const id = editando?.id || `prod_${Date.now()}`;
    await setDoc(doc(db, 'cotacoesManuais_produtos', id), { nome: form.nome.trim(), categoria: form.categoria });
    setForm({ nome: '', categoria: 'Pecuária' });
    setEditando(null);
    setMostrarForm(false);
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este produto? Preços já cadastrados pra ele vão ficar órfãos.')) return;
    await deleteDoc(doc(db, 'cotacoesManuais_produtos', id));
  }

  function abrirEdicao(p: ProdutoManual) {
    setEditando(p);
    setForm({ nome: p.nome, categoria: p.categoria });
    setMostrarForm(true);
  }

  async function popularPadrao() {
    for (const p of PRODUTOS_PADRAO) {
      const id = `prod_${p.nome.toLowerCase().replace(/\s+/g, '_')}`;
      await setDoc(doc(db, 'cotacoesManuais_produtos', id), p);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-[#3d5a45]">Produtos</h3>
        <div className="flex gap-2">
          {produtos.length === 0 && (
            <button onClick={popularPadrao} className="btn-outline text-xs px-3 py-2">
              Criar Boi/Vaca/Novilho/Novilha/Bezerro/Bezerra
            </button>
          )}
          <button onClick={() => { setEditando(null); setForm({ nome: '', categoria: 'Pecuária' }); setMostrarForm(true); }} className="btn-primary text-xs px-3 py-2">
            <Plus size={14} /> Novo Produto
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-[#e5e0d8] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[#3d5a45]">{editando ? 'Editar produto' : 'Novo produto'}</p>
            <button onClick={() => setMostrarForm(false)}><X size={16} /></button>
          </div>
          <input
            value={form.nome}
            onChange={e => setForm({ ...form, nome: e.target.value })}
            placeholder="Nome do produto (ex: Garrote)"
            className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c] focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none"
          />
          <select
            value={form.categoria}
            onChange={e => setForm({ ...form, categoria: e.target.value })}
            className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]"
          >
            <option>Pecuária</option>
            <option>Grãos</option>
            <option>Agricultura</option>
            <option>Outro</option>
          </select>
          <button onClick={salvar} className="btn-primary w-full"><Save size={14} /> Salvar</button>
        </div>
      )}

      <div className="bg-white border border-[#e5e0d8] rounded-2xl overflow-hidden">
        {produtos.length === 0 && <p className="p-4 text-sm text-[#6d6a66]">Nenhum produto cadastrado ainda.</p>}
        {produtos.map(p => (
          <div key={p.id} className="flex items-center justify-between p-3 border-b border-[#e5e0d8] last:border-0">
            <div>
              <p className="font-semibold text-[#3d5a45]">{p.nome}</p>
              <p className="text-xs text-[#6d6a66]">{p.categoria}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => abrirEdicao(p)} className="p-2 hover:bg-[#f5f2ed] text-[#6d6a66] rounded-xl"><Edit3 size={14} /></button>
              <button onClick={() => excluir(p.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Aba PREÇOS — a principal: produto + localização + preço + prazo + tipo
// ---------------------------------------------------------------------
function AbaPrecos({ precos, produtos, localizacoes }: { precos: PrecoManual[]; produtos: ProdutoManual[]; localizacoes: LocalizacaoManual[] }) {
  const [editando, setEditando] = useState<PrecoManual | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const vazio = {
    produtoId: produtos[0]?.id || '', localizacaoId: localizacoes[0]?.id || '',
    preco: 0, unidade: 'R$/@', prazoDias: 0, tipoNegocio: 'nao_informado' as PrecoManual['tipoNegocio'],
    dataCotacao: new Date().toISOString().slice(0, 10), observacao: '',
  };
  const [form, setForm] = useState(vazio);

  async function salvar() {
    if (!form.produtoId || !form.localizacaoId || form.preco <= 0) {
      alert('Preencha produto, localização e um preço maior que zero.');
      return;
    }
    const agora = new Date().toISOString();
    const id = editando?.id || `preco_${Date.now()}`;
    await setDoc(doc(db, 'cotacoesManuais_precos', id), {
      ...form,
      criadoEm: editando?.criadoEm || agora,
      atualizadoEm: agora,
    });
    setForm(vazio);
    setEditando(null);
    setMostrarForm(false);
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este preço?')) return;
    await deleteDoc(doc(db, 'cotacoesManuais_precos', id));
  }

  function abrirEdicao(p: PrecoManual) {
    setEditando(p);
    setForm({ produtoId: p.produtoId, localizacaoId: p.localizacaoId, preco: p.preco, unidade: p.unidade, prazoDias: p.prazoDias, tipoNegocio: p.tipoNegocio, dataCotacao: p.dataCotacao, observacao: p.observacao || '' });
    setMostrarForm(true);
  }

  const nomeProduto = (id: string) => produtos.find(p => p.id === id)?.nome || '(produto excluído)';
  const nomeLocal = (id: string) => { const l = localizacoes.find(l => l.id === id); return l ? `${l.local} — ${l.estado}` : '(local excluído)'; };

  const semCadastroBase = produtos.length === 0 || localizacoes.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#3d5a45]">Preços Cadastrados Manualmente</h3>
        <button
          onClick={() => { if (semCadastroBase) { alert('Cadastre pelo menos um Produto e uma Localização antes de lançar um preço.'); return; } setEditando(null); setForm(vazio); setMostrarForm(true); }}
          className="btn-primary text-xs px-3 py-2"
        >
          <Plus size={14} /> Novo Preço
        </button>
      </div>

      {semCadastroBase && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-sm text-amber-800">Cadastre primeiro pelo menos um <strong>Produto</strong> e uma <strong>Localização</strong> nas outras abas antes de lançar preços.</p>
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white border border-[#e5e0d8] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[#3d5a45]">{editando ? 'Editar preço' : 'Novo preço'}</p>
            <button onClick={() => setMostrarForm(false)}><X size={16} /></button>
          </div>

          <div>
            <label className="text-xs font-bold text-[#6d6a66] block mb-1">Produto</label>
            <select value={form.produtoId} onChange={e => setForm({ ...form, produtoId: e.target.value })} className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]">
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#6d6a66] block mb-1">Localização</label>
            <select value={form.localizacaoId} onChange={e => setForm({ ...form, localizacaoId: e.target.value })} className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]">
              {localizacoes.map(l => <option key={l.id} value={l.id}>{l.local} — {l.estado}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-[#6d6a66] block mb-1">Preço (R$)</label>
              <input type="number" step="0.01" value={form.preco || ''} onChange={e => setForm({ ...form, preco: Number(e.target.value) })} placeholder="0,00" className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6d6a66] block mb-1">Unidade</label>
              <select value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]">
                {UNIDADES_COMUNS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-[#6d6a66] block mb-1">Prazo (dias)</label>
              <input type="number" value={form.prazoDias} onChange={e => setForm({ ...form, prazoDias: Number(e.target.value) })} placeholder="0 = à vista" className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6d6a66] block mb-1">Tipo de negócio</label>
              <select value={form.tipoNegocio} onChange={e => setForm({ ...form, tipoNegocio: e.target.value as any })} className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45]">
                <option value="nao_informado">Não informa</option>
                <option value="SIF">SIF</option>
                <option value="FOB">FOB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#6d6a66] block mb-1">Data da cotação</label>
            <input type="date" value={form.dataCotacao} onChange={e => setForm({ ...form, dataCotacao: e.target.value })} className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c]" />
          </div>

          <div>
            <label className="text-xs font-bold text-[#6d6a66] block mb-1">Observação (opcional)</label>
            <input value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: negociado direto com produtor X" className="w-full px-4 py-2 border border-[#e5e0d8] rounded-xl bg-white text-[#3d5a45] placeholder:text-[#a8a49c]" />
          </div>

          <button onClick={salvar} className="btn-primary w-full"><Save size={14} /> Salvar</button>
        </div>
      )}

      <div className="bg-white border border-[#e5e0d8] rounded-2xl overflow-hidden overflow-x-auto">
        {precos.length === 0 && <p className="p-4 text-sm text-[#6d6a66]">Nenhum preço lançado ainda.</p>}
        {precos.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f2ed]">
                <th className="text-left p-3 text-xs font-bold text-[#3d5a45]">Produto</th>
                <th className="text-left p-3 text-xs font-bold text-[#3d5a45]">Local</th>
                <th className="text-left p-3 text-xs font-bold text-[#3d5a45]">Preço</th>
                <th className="text-left p-3 text-xs font-bold text-[#3d5a45]">Prazo</th>
                <th className="text-left p-3 text-xs font-bold text-[#3d5a45]">Tipo</th>
                <th className="text-left p-3 text-xs font-bold text-[#3d5a45]">Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {precos.sort((a, b) => b.dataCotacao.localeCompare(a.dataCotacao)).map(p => (
                <tr key={p.id} className="border-b border-[#e5e0d8] last:border-0">
                  <td className="p-3 font-semibold text-[#3d5a45]">{nomeProduto(p.produtoId)}</td>
                  <td className="p-3 text-[#6d6a66]">{nomeLocal(p.localizacaoId)}</td>
                  <td className="p-3 font-bold text-[#3d5a45]">R$ {p.preco.toFixed(2)} <span className="text-[10px] font-normal text-[#6d6a66]">{p.unidade}</span></td>
                  <td className="p-3 text-[#6d6a66]">{p.prazoDias === 0 ? 'À vista' : `${p.prazoDias}d`}</td>
                  <td className="p-3 text-[#6d6a66]">{p.tipoNegocio === 'nao_informado' ? '—' : p.tipoNegocio}</td>
                  <td className="p-3 text-[#6d6a66]">{new Date(p.dataCotacao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicao(p)} className="p-2 hover:bg-[#f5f2ed] text-[#6d6a66] rounded-xl"><Edit3 size={14} /></button>
                      <button onClick={() => excluir(p.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Componente principal — abas internas
// ---------------------------------------------------------------------
export default function CotacoesManuais() {
  const [aba, setAba] = useState<'produtos' | 'localizacao' | 'precos'>('precos');
  const [produtos] = useFirestoreCollection<ProdutoManual>('cotacoesManuais_produtos');
  const [localizacoes] = useFirestoreCollection<LocalizacaoManual>('cotacoesManuais_localizacoes');
  const [precos] = useFirestoreCollection<PrecoManual>('cotacoesManuais_precos');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#3d5a45]">Cotações Manuais</h2>
        <p className="text-sm text-[#6d6a66]">
          Cadastre preços à mão pra suprir a falta de fonte automática num local/produto específico. Esses preços aparecem em Cotações identificados como "Cadastro manual", nunca misturados com dado de fonte automática sem identificação.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#e5e0d8]">
        {[
          { id: 'precos' as const, label: `Preços (${precos.length})` },
          { id: 'produtos' as const, label: `Produtos (${produtos.length})` },
          { id: 'localizacao' as const, label: `Localização (${localizacoes.length})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${aba === t.id ? 'border-[#3d5a45] text-[#3d5a45]' : 'border-transparent text-[#6d6a66]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'precos' && <AbaPrecos precos={precos} produtos={produtos} localizacoes={localizacoes} />}
      {aba === 'produtos' && <AbaProdutos produtos={produtos} />}
      {aba === 'localizacao' && <AbaLocalizacao localizacoes={localizacoes} />}
    </div>
  );
}
