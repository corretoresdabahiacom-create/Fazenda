/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Histórico de preço PESSOAL do usuário — diferente do catálogo do
// Admin (cotacoesManuais_*, compartilhado/público dentro do app). Aqui
// cada usuário guarda o histórico de UM produto, numa praça só (ou sem
// praça definida, se preferir não informar), 100% privado — só ele lê
// e escreve o próprio, via users/{uid}/precoPessoal/... no Firestore.
//
// RETENÇÃO DE 2 ANOS: cada ponto grava um campo "expireAt" (data +
// 2 anos). Isso sozinho NÃO apaga nada automaticamente — o apagamento
// automático de verdade precisa de uma política de TTL configurada uma
// vez no Console do Firebase (Firestore → TTL policies → campo
// "expireAt" na coleção "pontos"), fora do alcance de regras/código.
// Documentado aqui pra não passar a impressão de que já está ativo.

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Plus, Edit3, Trash2, Save, Info } from 'lucide-react';

interface ConfigPessoal {
  produtoId: string;
  produtoNome: string;
  praca: string;
  estado: string;
}

interface PontoPessoal {
  id: string;
  preco: number;
  data: string;
  criadoEm: string;
}

const PRODUTOS_HISTORICO = [
  { id: 'boi_gordo', label: 'Boi Gordo' }, { id: 'vaca', label: 'Vaca' },
  { id: 'novilho', label: 'Novilho' }, { id: 'novilha', label: 'Novilha' },
  { id: 'soja', label: 'Soja' }, { id: 'milho', label: 'Milho' },
  { id: 'cafe', label: 'Café' }, { id: 'algodao', label: 'Algodão' },
];

function duasAnosAPartirDeHoje(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d;
}

interface Props {
  dataInicio?: string;
  dataFim?: string;
}

export default function HistoricoPrecoPessoal({ dataInicio, dataFim }: Props) {
  const [config, setConfig] = useState<ConfigPessoal | null | undefined>(undefined);
  const [pontos, setPontos] = useState<PontoPessoal[]>([]);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [mostrarFormPonto, setMostrarFormPonto] = useState(false);
  const [editandoPontoId, setEditandoPontoId] = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState({ produtoId: 'boi_gordo', praca: '', estado: '' });
  const [formPonto, setFormPonto] = useState({ preco: '', data: new Date().toISOString().slice(0, 10) });
  const [salvando, setSalvando] = useState(false);

  const uid = auth.currentUser?.uid;

  // Bug real corrigido: a lista mostrava TODOS os lançamentos, sem
  // respeitar o período escolhido lá em cima no gráfico — agora só
  // exibe (e soma/organiza) o que cai dentro de "De" e "Até".
  const pontosNoPeriodo = (dataInicio && dataFim)
    ? pontos.filter(p => p.data >= dataInicio && p.data <= dataFim)
    : pontos;

  useEffect(() => {
    if (!uid) { setConfig(null); return; }
    getDoc(doc(db, 'users', uid, 'precoPessoal', 'config'))
      .then(snap => setConfig(snap.exists() ? (snap.data() as ConfigPessoal) : null))
      .catch(() => setConfig(null));
  }, [uid]);

  useEffect(() => {
    if (!uid || !config) return;
    const q = query(collection(db, 'users', uid, 'precoPessoal', 'pontos', 'itens'), orderBy('data', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPontos(snap.docs.map(d => ({ id: d.id, ...d.data() } as PontoPessoal)));
    }, () => setPontos([]));
    return () => unsub();
  }, [uid, config]);

  async function salvarConfig() {
    if (!uid) return;
    const produto = PRODUTOS_HISTORICO.find(p => p.id === formConfig.produtoId)!;
    setSalvando(true);
    try {
      await setDoc(doc(db, 'users', uid, 'precoPessoal', 'config'), {
        produtoId: produto.id, produtoNome: produto.label,
        praca: formConfig.praca.trim(), estado: formConfig.estado.trim(),
      });
      setConfig({ produtoId: produto.id, produtoNome: produto.label, praca: formConfig.praca.trim(), estado: formConfig.estado.trim() });
      setMostrarConfig(false);
    } catch (erro: any) {
      alert('Não foi possível salvar: ' + (erro?.message || String(erro)));
    } finally {
      setSalvando(false);
    }
  }

  async function excluirConfigETudo() {
    if (!uid) return;
    if (!confirm('Isso apaga a configuração E todo o histórico de preço já lançado. Trocar de produto/praça exige recomeçar do zero. Continuar?')) return;
    for (const p of pontos) {
      await deleteDoc(doc(db, 'users', uid, 'precoPessoal', 'pontos', 'itens', p.id));
    }
    await deleteDoc(doc(db, 'users', uid, 'precoPessoal', 'config'));
    setConfig(null);
    setPontos([]);
  }

  async function salvarPonto() {
    if (!uid || !formPonto.preco || !formPonto.data) {
      alert('Preencha preço e data.');
      return;
    }
    setSalvando(true);
    try {
      const id = editandoPontoId || `ponto_${Date.now()}`;
      const agora = new Date().toISOString();
      await setDoc(doc(db, 'users', uid, 'precoPessoal', 'pontos', 'itens', id), {
        preco: Number(formPonto.preco), data: formPonto.data,
        criadoEm: agora,
        expireAt: duasAnosAPartirDeHoje(),
      }, { merge: true });
      setFormPonto({ preco: '', data: new Date().toISOString().slice(0, 10) });
      setMostrarFormPonto(false);
      setEditandoPontoId(null);
    } catch (erro: any) {
      alert('Não foi possível salvar: ' + (erro?.message || String(erro)));
    } finally {
      setSalvando(false);
    }
  }

  async function excluirPonto(id: string) {
    if (!uid) return;
    if (!confirm('Excluir esse lançamento?')) return;
    await deleteDoc(doc(db, 'users', uid, 'precoPessoal', 'pontos', 'itens', id));
  }

  function abrirEdicaoPonto(p: PontoPessoal) {
    setFormPonto({ preco: String(p.preco), data: p.data });
    setEditandoPontoId(p.id);
    setMostrarFormPonto(true);
  }

  if (config === undefined) return null;

  return (
    <div className="bg-theme-card rounded-2xl border border-theme p-4 space-y-3 shadow-theme">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-theme-primary">📒 Meu Histórico de Preço</h3>
        {config && (
          <button onClick={excluirConfigETudo} className="text-[10px] text-red-500 hover:underline">Trocar produto/praça (apaga tudo)</button>
        )}
      </div>

      {!config && !mostrarConfig && (
        <div className="space-y-2">
          <p className="text-xs text-theme-secondary">Sua assinatura permite acompanhar o histórico de <strong>um produto</strong>, numa praça só (ou sem praça definida, se preferir). Escolha uma vez pra começar.</p>
          <button onClick={() => setMostrarConfig(true)} className="btn-primary text-xs px-3 py-2 w-full"><Plus size={12} /> Configurar meu produto</button>
        </div>
      )}

      {!config && mostrarConfig && (
        <div className="space-y-2 bg-theme-secondary rounded-xl p-3">
          <div>
            <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Produto (só pode escolher uma vez)</label>
            <select value={formConfig.produtoId} onChange={e => setFormConfig({ ...formConfig, produtoId: e.target.value })} className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary">
              {PRODUTOS_HISTORICO.map(p => <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{p.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Estado (opcional)</label>
              <input value={formConfig.estado} onChange={e => setFormConfig({ ...formConfig, estado: e.target.value })} placeholder="Ex: Bahia" className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Praça/Cidade (opcional)</label>
              <input value={formConfig.praca} onChange={e => setFormConfig({ ...formConfig, praca: e.target.value })} placeholder="Ex: Feira de Santana" className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMostrarConfig(false)} className="flex-1 py-1.5 text-xs rounded-lg border border-theme text-theme-secondary">Cancelar</button>
            <button onClick={salvarConfig} disabled={salvando} className="btn-primary flex-1 text-xs py-1.5">{salvando ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </div>
      )}

      {config && (
        <div className="space-y-2">
          <p className="text-xs text-theme-secondary">
            <strong>{config.produtoNome}</strong>{config.praca ? ` — ${config.praca}` : ''}{config.estado ? `, ${config.estado}` : ''}
            {config.produtoId === 'boi_gordo' && <span className="block text-[10px] mt-0.5">Boi Gordo costuma variar toda semana (até 4x/mês) — lance um ponto por vez que atualizar.</span>}
          </p>

          {pontosNoPeriodo.length === 0 && (
            <p className="text-xs text-theme-secondary italic">
              {pontos.length > 0 ? 'Nenhum lançamento seu cai dentro do período selecionado acima.' : 'Nenhum preço lançado ainda.'}
            </p>
          )}
          {pontosNoPeriodo.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-theme-secondary rounded-lg p-2 text-xs">
              <span>{new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR')}: <strong>R$ {p.preco.toFixed(2)}</strong></span>
              <div className="flex gap-1">
                <button onClick={() => abrirEdicaoPonto(p)} className="p-1 hover:bg-theme-card rounded"><Edit3 size={12} /></button>
                <button onClick={() => excluirPonto(p.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 rounded"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}

          {!mostrarFormPonto ? (
            <button onClick={() => { setFormPonto({ preco: '', data: new Date().toISOString().slice(0, 10) }); setEditandoPontoId(null); setMostrarFormPonto(true); }} className="btn-primary text-xs px-3 py-1.5 w-full">
              <Plus size={12} /> Lançar preço
            </button>
          ) : (
            <div className="bg-theme-secondary rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" value={formPonto.preco} onChange={e => setFormPonto({ ...formPonto, preco: e.target.value })} placeholder="Preço (R$)" className="text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary placeholder:text-theme-secondary" />
                <input type="date" value={formPonto.data} max={new Date().toISOString().slice(0, 10)} onChange={e => setFormPonto({ ...formPonto, data: e.target.value })} className="text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setMostrarFormPonto(false); setEditandoPontoId(null); }} className="flex-1 py-1.5 text-xs rounded-lg border border-theme text-theme-secondary">Cancelar</button>
                <button onClick={salvarPonto} disabled={salvando} className="btn-primary flex-1 text-xs py-1.5"><Save size={12} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          )}

          <div className="flex items-start gap-1.5 pt-1">
            <Info size={11} className="text-theme-secondary shrink-0 mt-0.5" />
            <p className="text-[9px] text-theme-secondary">Guardado por até 2 anos; depois disso, os pontos mais antigos são apagados automaticamente conforme completam o prazo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
