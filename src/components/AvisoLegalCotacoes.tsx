/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Aviso legal obrigatório antes de acessar Cotações — o usuário precisa
// confirmar ciência de que os preços podem variar por local/tempo/
// negociação antes de ver qualquer dado. A resposta fica salva no
// Firestore (não pergunta de novo depois de aceitar).

import { useEffect, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { AlertTriangle } from 'lucide-react';

export default function AvisoLegalCotacoes({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'carregando' | 'precisa_aceitar' | 'aceito' | 'desistiu'>('carregando');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setStatus('precisa_aceitar'); return; }
    getDoc(doc(db, 'users', uid, 'preferences', 'cotacoesAviso'))
      .then(snap => setStatus(snap.exists() && snap.data()?.aceito ? 'aceito' : 'precisa_aceitar'))
      .catch(() => setStatus('precisa_aceitar'));
  }, []);

  async function aceitar() {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(doc(db, 'users', uid, 'preferences', 'cotacoesAviso'), {
        aceito: true,
        aceitoEm: new Date().toISOString(),
      });
    }
    setStatus('aceito');
  }

  if (status === 'carregando') return null;

  if (status === 'aceito') return <>{children}</>;

  if (status === 'desistiu') {
    return (
      <div className="bg-theme-card rounded-2xl border border-theme p-8 text-center space-y-3 shadow-theme">
        <p className="text-sm text-theme-secondary">Você optou por não acessar as Cotações agora. Pode voltar quando quiser — o aviso aparece de novo até você confirmar ciência.</p>
      </div>
    );
  }

  return (
    <div className="bg-theme-card rounded-2xl border-2 border-amber-300 dark:border-amber-700 p-6 space-y-4 shadow-theme max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
          <AlertTriangle className="text-amber-600 dark:text-amber-400" size={26} />
        </div>
        <h2 className="text-lg font-bold text-theme-primary">Aviso importante antes de continuar</h2>
      </div>
      <div className="text-sm text-theme-secondary space-y-2 leading-relaxed">
        <p>Os preços mostrados em Cotações podem sofrer <strong>variações de local, tempo e negociação</strong> — o valor real numa transação depende de fatores que a plataforma não controla nem consegue prever com exatidão.</p>
        <p>A plataforma <strong>não se responsabiliza</strong> pelos valores apresentados. As negociações <strong>não devem se basear apenas</strong> nas informações daqui.</p>
        <p>Ao continuar, você declara estar <strong>ciente do risco</strong> e assume a responsabilidade pelo uso dessas informações.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => setStatus('desistiu')} className="flex-1 py-2.5 rounded-xl border border-theme text-theme-secondary font-bold text-sm">
          Desistir
        </button>
        <button onClick={aceitar} className="btn-primary flex-1 py-2.5 text-sm">
          Ciente — Continuar
        </button>
      </div>
    </div>
  );
}
