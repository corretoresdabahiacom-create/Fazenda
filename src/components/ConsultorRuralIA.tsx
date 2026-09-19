/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, Info } from 'lucide-react';
import {
  AccountPayable, AccountReceivable, Talhao, IndividualAnimal, Property,
  ReproductionEvent, HealthEvent, MilkProductionRecord, FarmDocument, Machine, MaintenanceRecord, InventoryItem,
} from '../types';
import { fetchWeatherSnapshot } from '../lib/weatherRules';
import { answerRuralQuestion } from '../lib/ruralAdvisor';
import { authFetch } from '../lib/authFetch';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  basedOnRealData?: boolean;
}

interface Props {
  activeProperty?: Property | null;
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  talhoes: Talhao[];
  individualAnimals: IndividualAnimal[];
  reproductionEvents: ReproductionEvent[];
  healthEvents: HealthEvent[];
  milkRecords: MilkProductionRecord[];
  documents: FarmDocument[];
  machines: Machine[];
  maintenanceRecords: MaintenanceRecord[];
  inventory: InventoryItem[];
}

const SUGGESTIONS = [
  'Posso pulverizar hoje?',
  'Qual o preço do boi gordo hoje?',
  'Qual meu saldo financeiro?',
  'Alguma vaca próxima do parto?',
  'Tem alguma vacina pendente?',
  'Tem documento vencendo?',
  'Meu estoque está baixo?',
];

export default function ConsultorRuralIA({
  activeProperty, accountsPayable, accountsReceivable, talhoes, individualAnimals,
  reproductionEvents, healthEvents, milkRecords, documents, machines, maintenanceRecords, inventory,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAsk(q: string) {
    if (!q.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);

    try {
      // Motor de regras local — não chama nenhuma API de IA externa, então
      // funciona sempre, de graça, sem depender de nenhuma chave configurada.
      let weather: Awaited<ReturnType<typeof fetchWeatherSnapshot>> | null = null;
      if (activeProperty?.location) {
        try {
          weather = await fetchWeatherSnapshot(activeProperty.location.lat, activeProperty.location.lng);
        } catch {
          weather = null;
        }
      }

      const contextoFazenda = {
        weather,
        accountsPayable,
        accountsReceivable,
        talhoes,
        individualAnimals,
        reproductionEvents,
        healthEvents,
        milkRecords,
        documents,
        machines,
        maintenanceRecords,
        inventory,
      };

      // FUNCIONALIDADE QUE ESTAVA DESCONECTADA: o endpoint
      // /api/consultor-rural (IA de verdade, cruzando os dados reais da
      // fazenda) existia pronto no projeto mas NUNCA era chamado — a
      // tela usava só a lógica local de palavras-chave, que responde
      // apenas os tópicos pré-programados. Agora a IA é o caminho
      // principal; a lógica local vira reserva pra quando não houver
      // chave de IA configurada, a chamada falhar, ou a resposta vier
      // vazia. Assim nada quebra se a IA estiver fora do ar.
      let respostaIA: string | null = null;
      try {
        const res = await authFetch('/api/consultor-rural', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, context: contextoFazenda }),
        });
        if (res.ok) {
          const json = await res.json();
          const texto = String(json?.answer || '').trim();
          // O endpoint devolve HTTP 200 com um texto genérico de reserva
          // ("Não consegui processar...") quando a IA falha ou não há
          // chave configurada. Se aceitássemos isso como resposta
          // válida, a lógica local (que resolve vários tópicos bem)
          // nunca seria usada — o produtor receberia uma mensagem
          // inútil no lugar de uma resposta de verdade.
          const ehRespostaGenerica = /não consegui processar sua pergunta agora/i.test(texto);
          if (texto && !ehRespostaGenerica) respostaIA = texto;
        }
      } catch {
        // IA indisponível — segue pro caminho local, sem alarde.
      }

      if (respostaIA) {
        setMessages(prev => [...prev, { role: 'assistant', text: respostaIA, basedOnRealData: true }]);
      } else {
        const result = await answerRuralQuestion(q, contextoFazenda);
        setMessages(prev => [...prev, { role: 'assistant', text: result.answer, basedOnRealData: result.basedOnRealData }]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 flex flex-col h-full">
      <div>
        <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
          <Sparkles className="text-[var(--primary)]" size={20} /> Consultor Rural IA
        </h1>
        <p className="text-sm text-theme-secondary">Pergunte sobre clima, financeiro, talhões ou rebanho — a resposta usa os dados reais já cadastrados na sua fazenda (sem depender de nenhuma IA externa).</p>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleAsk(s)}
              className="text-xs bg-theme-secondary hover:bg-theme-secondary text-theme-secondary px-3 py-2 rounded-full"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto min-h-[200px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-[var(--primary)] text-white' : 'bg-theme-card border border-theme text-theme-primary'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.role === 'assistant' && m.basedOnRealData != null && (
                <p className={`text-[10px] mt-2 flex items-center gap-1 ${m.basedOnRealData ? 'text-green-600' : 'text-theme-secondary'}`}>
                  {m.basedOnRealData ? <CheckCircle2 size={10} /> : <Info size={10} />}
                  {m.basedOnRealData ? 'Baseado em dados reais da sua fazenda' : 'Orientação geral (sem dado específico suficiente)'}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-theme-card border border-theme rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm text-theme-secondary shadow-theme text-theme-primary">
              <Loader2 size={14} className="animate-spin" /> Consultando...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleAsk(question); }}
        className="flex gap-2 sticky bottom-0 bg-transparent pt-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: posso plantar milho semana que vem?"
          className="flex-1 border border-theme rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 bg-theme-card text-theme-primary placeholder:text-theme-secondary"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl px-4 py-2.5 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
