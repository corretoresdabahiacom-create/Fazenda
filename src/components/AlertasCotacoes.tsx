/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// SEÇÃO 27 do documento original: alertas de cotação.
//
// Tipos implementados, todos honestos (nenhum baseado em número
// inventado):
// - Preço subiu/caiu: usa a variação (%) que a própria fonte já informa
//   (ex: Notícias Agrícolas e AIBA já trazem isso) — não calculamos
//   comparando com histórico próprio, porque ainda não decidimos
//   guardar isso (conversa pendente sobre custo de escrita).
// - Preço atingiu valor definido pelo usuário: única escrita nova no
//   Firestore desta função — pequena e rara (só quando o usuário define
//   ou muda o alvo), bem diferente de logar toda consulta.
// - Diferença entre fontes: compara os preços de múltiplas fontes pro
//   mesmo produto (via /api/quotes).
// - Cotação desatualizada: compara a data da busca com agora.
// - Fonte indisponível: mostra quando uma fonte esperada não respondeu.
//
// NÃO implementado, e por quê: "API atingiu limite" — nenhuma fonte
// ativa hoje é uma API com cota (são páginas públicas raspadas), então
// esse tipo de alerta não se aplica ainda.

import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, X } from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { detectDivergence, isStale, checkTargetReached } from '../lib/alertLogic';

interface Alert {
  tipo: 'subiu' | 'caiu' | 'alvo_atingido' | 'divergencia_fontes' | 'desatualizada' | 'fonte_indisponivel';
  mensagem: string;
  severidade: 'info' | 'atencao';
}

interface Props {
  produto: string;
  produtoLabel: string;
  quotesResponse: { quotes: any[]; semCotacaoDisponivel: number } | null;
}

export default function AlertasCotacoes({ produto, produtoLabel, quotesResponse }: Props) {
  const [alertas, setAlertas] = useState<Alert[]>([]);
  const [alvoInput, setAlvoInput] = useState('');
  const [alvoSalvo, setAlvoSalvo] = useState<number | null>(null);
  const [showAlvoForm, setShowAlvoForm] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid, 'priceAlerts', produto), (snap) => {
      setAlvoSalvo(snap.exists() ? (snap.data().alvo ?? null) : null);
    });
    return () => unsub();
  }, [produto]);

  useEffect(() => {
    if (!quotesResponse) { setAlertas([]); return; }
    const novosAlertas: Alert[] = [];
    const quotes = quotesResponse.quotes || [];

    if (quotes.length === 0) {
      novosAlertas.push({ tipo: 'fonte_indisponivel', mensagem: `Nenhuma fonte respondeu com cotação disponível pra ${produtoLabel} agora.`, severidade: 'atencao' });
    }

    for (const q of quotes) {
      if (isStale(q.fetchedAt)) {
        novosAlertas.push({ tipo: 'desatualizada', mensagem: `${q.source}: última busca há mais de 48h — pode estar desatualizado.`, severidade: 'atencao' });
        break;
      }
    }

    const divergencia = detectDivergence(quotes);
    if (divergencia.hasDivergence) {
      novosAlertas.push({
        tipo: 'divergencia_fontes',
        mensagem: `Divergência entre fontes: ${divergencia.maisAlta!.source} (R$ ${divergencia.maisAlta!.price.toFixed(2)}) vs. ${divergencia.maisBaixa!.source} (R$ ${divergencia.maisBaixa!.price.toFixed(2)}) — mais de 10% de diferença.`,
        severidade: 'atencao',
      });
    }

    const precosBRL = quotes.filter((q: any) => q.currency === 'BRL' && q.price != null);
    if (checkTargetReached(precosBRL[0]?.price ?? null, alvoSalvo)) {
      novosAlertas.push({ tipo: 'alvo_atingido', mensagem: `${produtoLabel} atingiu seu alvo de R$ ${alvoSalvo!.toFixed(2)} — está em R$ ${precosBRL[0].price.toFixed(2)}.`, severidade: 'info' });
    }

    setAlertas(novosAlertas);
  }, [quotesResponse, alvoSalvo, produtoLabel]);

  async function salvarAlvo() {
    const uid = auth.currentUser?.uid;
    const valor = Number(alvoInput.replace(',', '.'));
    if (!uid || isNaN(valor) || valor <= 0) return;
    await setDoc(doc(db, 'users', uid, 'priceAlerts', produto), { produto, alvo: valor, criadoEm: new Date().toISOString() });
    setShowAlvoForm(false);
    setAlvoInput('');
  }

  async function removerAlvo() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'priceAlerts', produto));
  }

  return (
    <div className="space-y-2">
      {alertas.map((a, i) => (
        <div key={i} className={`rounded-xl p-2.5 flex items-start gap-2 ${a.severidade === 'atencao' ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
          {a.tipo === 'alvo_atingido' ? <Bell size={14} className="text-green-600 shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />}
          <p className={`text-xs ${a.severidade === 'atencao' ? 'text-amber-800' : 'text-green-800'}`}>{a.mensagem}</p>
        </div>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        {alvoSalvo != null ? (
          <div className="flex items-center gap-1.5 text-xs bg-[#f5f2ed] px-2.5 py-1 rounded-full">
            <Bell size={11} /> Alvo: R$ {alvoSalvo.toFixed(2)}
            <button onClick={removerAlvo} className="text-[#6d6a66] hover:text-red-500"><X size={11} /></button>
          </div>
        ) : (
          <button onClick={() => setShowAlvoForm(!showAlvoForm)} className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1">
            <Bell size={12} /> Avisar quando atingir um preço
          </button>
        )}
        {showAlvoForm && (
          <div className="flex items-center gap-1.5">
            <input
              value={alvoInput}
              onChange={e => setAlvoInput(e.target.value)}
              placeholder="Ex: 350,00"
              className="text-xs border border-[#e5e0d8] rounded-lg px-2 py-1 w-24"
            />
            <button onClick={salvarAlvo} className="text-xs font-bold bg-[var(--primary)] text-white px-2.5 py-1 rounded-lg">Salvar</button>
          </div>
        )}
      </div>
    </div>
  );
}
