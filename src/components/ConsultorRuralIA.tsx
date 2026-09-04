/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, Info } from 'lucide-react';
import { AccountPayable, AccountReceivable, Talhao, IndividualAnimal, Property } from '../types';
import { fetchWeatherSnapshot } from '../lib/weatherRules';
import { answerRuralQuestion } from '../lib/ruralAdvisor';

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
}

const SUGGESTIONS = [
  'Posso pulverizar hoje?',
  'Qual meu saldo financeiro?',
  'Quantos talhões estão ativos?',
  'Como está o clima hoje?',
];

export default function ConsultorRuralIA({
  activeProperty, accountsPayable, accountsReceivable, talhoes, individualAnimals,
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

      const result = answerRuralQuestion(q, {
        weather,
        accountsPayable,
        accountsReceivable,
        talhoes,
        individualAnimals,
      });

      setMessages(prev => [...prev, { role: 'assistant', text: result.answer, basedOnRealData: result.basedOnRealData }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 flex flex-col h-full">
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="text-[#2d6a4f]" size={20} /> Consultor Rural IA
        </h1>
        <p className="text-sm text-gray-500">Pergunte sobre clima, financeiro, talhões ou rebanho — a resposta usa os dados reais já cadastrados na sua fazenda (sem depender de nenhuma IA externa).</p>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleAsk(s)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-full"
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
                m.role === 'user' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.role === 'assistant' && m.basedOnRealData != null && (
                <p className={`text-[10px] mt-2 flex items-center gap-1 ${m.basedOnRealData ? 'text-green-600' : 'text-gray-400'}`}>
                  {m.basedOnRealData ? <CheckCircle2 size={10} /> : <Info size={10} />}
                  {m.basedOnRealData ? 'Baseado em dados reais da sua fazenda' : 'Orientação geral (sem dado específico suficiente)'}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm text-gray-400">
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
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white rounded-xl px-4 py-2.5 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
