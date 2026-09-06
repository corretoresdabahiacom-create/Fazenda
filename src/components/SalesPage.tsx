/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  X, CheckCircle2, TrendingUp, CloudSun, Wallet, Beef, Sparkles, Bell,
  ChevronDown, ArrowRight, ShieldCheck, Smartphone, FileWarning,
} from 'lucide-react';
import { PlanTier, PLAN_PRICES } from '../types';

interface Props {
  onClose: () => void;
  onStartTrial: () => void;
}

// Ilustração original simples (não fotográfica) do "antes e depois" —
// papel/caderno bagunçado virando um painel organizado.
function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 260" className="w-full max-w-md mx-auto">
      <rect x="10" y="30" width="160" height="200" rx="10" fill="#f3ede2" stroke="#d8cdb8" strokeWidth="2" transform="rotate(-6 90 130)" />
      <g transform="rotate(-6 90 130)" stroke="#b7a888" strokeWidth="2" strokeLinecap="round">
        <line x1="30" y1="60" x2="150" y2="55" />
        <line x1="30" y1="80" x2="120" y2="78" />
        <line x1="30" y1="100" x2="140" y2="102" />
        <line x1="30" y1="130" x2="100" y2="128" />
        <line x1="30" y1="150" x2="150" y2="148" />
        <line x1="30" y1="170" x2="110" y2="172" />
      </g>
      <text x="45" y="45" fontSize="14" fill="#8a7a5c" transform="rotate(-6 90 130)" fontFamily="serif" fontStyle="italic">anotações soltas</text>

      <path d="M180 130 L230 130" stroke="#2d6a4f" strokeWidth="4" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#2d6a4f" />
        </marker>
      </defs>

      <rect x="240" y="20" width="150" height="220" rx="16" fill="#16301f" />
      <rect x="255" y="40" width="120" height="24" rx="6" fill="#4caf6e" opacity="0.25" />
      <rect x="255" y="40" width="70" height="24" rx="6" fill="#4caf6e" />
      <rect x="255" y="75" width="55" height="45" rx="8" fill="#1c3a26" />
      <rect x="317" y="75" width="55" height="45" rx="8" fill="#1c3a26" />
      <rect x="255" y="128" width="117" height="30" rx="6" fill="#1c3a26" />
      <rect x="255" y="166" width="117" height="30" rx="6" fill="#1c3a26" />
      <rect x="255" y="204" width="117" height="20" rx="5" fill="#4caf6e" opacity="0.7" />
    </svg>
  );
}

const PAIN_POINTS = [
  { icon: FileWarning, text: 'Vacina, remanejo de pasto ou parcela do financiamento que passa batido porque estava só na sua cabeça ou num caderno' },
  { icon: TrendingUp, text: 'Dificuldade de saber, no fim do mês, se a fazenda deu lucro de verdade ou só a sensação de que "deu pra pagar as contas"' },
  { icon: CloudSun, text: 'Pulverização ou aplicação feita no dia errado, perdendo produto e dinheiro por causa do clima' },
  { icon: Beef, text: 'Planilhas separadas para rebanho, financeiro e talhão que nunca conversam entre si' },
];

const BENEFITS = [
  {
    icon: Bell,
    title: 'Nada mais esquecido',
    text: 'Vacina, aluguel de pasto, plantio, colheita, conta a pagar — a Central de Obrigações avisa 2 a 3 dias antes, e destaca em vermelho o que já venceu.',
  },
  {
    icon: Wallet,
    title: 'Clareza financeira real',
    text: 'Contas a pagar e a receber, centro de custo por safra ou por lote, fluxo de caixa projetado — sem depender de planilha solta ou "no olho".',
  },
  {
    icon: Beef,
    title: 'Rebanho sob controle, do lote ao indivíduo',
    text: 'Cadastro por lote para o dia a dia, e cadastro individual por brinco para quem trabalha genética, reprodução e produção de leite a sério.',
  },
  {
    icon: CloudSun,
    title: 'Clima entra na decisão',
    text: 'Alertas de chuva e vento na hora de pulverizar, geada, estresse térmico do rebanho — direto na tela, sem precisar abrir outro aplicativo.',
  },
  {
    icon: Sparkles,
    title: 'Consultor Rural sempre à mão',
    text: 'Pergunte sobre seus próprios dados — financeiro, rebanho, talhões — e receba uma resposta na hora, sem depender de internet de IA nem custo extra.',
  },
  {
    icon: Smartphone,
    title: 'Funciona no celular, tablet e computador',
    text: 'Instale como aplicativo no seu celular e leve a gestão da fazenda pro curral, pro talhão, pra qualquer lugar.',
  },
];

const FAQS = [
  { q: 'Preciso entender de computador para usar?', a: 'Não. As telas foram pensadas para serem simples e diretas — se você usa WhatsApp, consegue usar o Agro Gestão.' },
  { q: 'Meus dados ficam seguros?', a: 'Sim. Cada conta é isolada e só você tem acesso aos seus dados. Não guardamos números de cartão nem dados bancários — o pagamento acontece direto na página segura do Mercado Pago, Stripe ou PayPal.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim, a qualquer momento, direto pelo aplicativo em "Minha Assinatura" — sem precisar ligar ou mandar e-mail para cancelar.' },
  { q: 'E se eu não gostar depois de assinar?', a: 'Você tem 3 dias de teste totalmente grátis, sem precisar cadastrar nenhum pagamento. Depois disso, se quiser continuar conhecendo o aplicativo, basta assinar um plano — você ganha mais 7 dias podendo cancelar a qualquer momento sem pagar nada. Só é cobrado se você não cancelar até o fim desse prazo.' },
  { q: 'Funciona para qualquer tamanho de fazenda?', a: 'Sim — os planos variam pelo número de propriedades cadastradas, do produtor com uma fazenda até quem administra várias.' },
];

export default function SalesPage({ onClose, onStartTrial }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="fixed inset-0 z-[80] bg-theme-card overflow-y-auto">
      <div className="sticky top-0 z-10 bg-theme-card/95 backdrop-blur border-b border-theme">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-serif italic font-bold text-lg text-[var(--primary)]">Agro Gestão</span>
          <button onClick={onClose} className="p-2 rounded-full bg-theme-secondary text-theme-secondary">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-14 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-soft)] px-3 py-1 rounded-full mb-4">
            Feito para o produtor rural brasileiro
          </span>
          <h1 className="font-serif italic font-bold text-3xl md:text-4xl text-theme-primary leading-tight mb-4">
            Sua fazenda organizada, sem depender da memória nem do caderno.
          </h1>
          <p className="text-theme-secondary text-sm md:text-base mb-6">
            Rebanho, agricultura, financeiro e clima num só lugar — com avisos automáticos de tudo que tem prazo,
            para você tomar decisão com dado na mão, não no chute.
          </p>
          <button onClick={onStartTrial} className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-md">
            Começar grátis por 3 dias <ArrowRight size={16} />
          </button>
          <p className="text-[11px] text-theme-secondary mt-2">Sem cartão de crédito para começar. Cancele quando quiser.</p>
        </div>
        <HeroIllustration />
      </section>

      {/* Dor / agitação */}
      <section className="bg-theme-secondary/40 py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-serif italic font-bold text-2xl text-theme-primary text-center mb-8">
            Se algum desses problemas soa familiar, você não está sozinho
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {PAIN_POINTS.map((p, i) => (
              <div key={i} className="bg-theme-card rounded-2xl border border-theme p-4 flex items-start gap-3">
                <p.icon size={20} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-theme-secondary">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="font-serif italic font-bold text-2xl text-theme-primary text-center mb-2">
          Tudo isso muda com o Agro Gestão
        </h2>
        <p className="text-theme-secondary text-sm text-center mb-10 max-w-lg mx-auto">
          Um aplicativo pensado do zero para a rotina real do campo — não uma planilha de escritório adaptada para o agro.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {BENEFITS.map((b, i) => (
            <div key={i} className="border border-theme rounded-2xl p-5">
              <div className="w-11 h-11 rounded-xl bg-[var(--primary-soft)] flex items-center justify-center mb-3">
                <b.icon size={20} className="text-[var(--primary)]" />
              </div>
              <h3 className="font-bold text-theme-primary text-sm mb-1.5">{b.title}</h3>
              <p className="text-xs text-theme-secondary leading-relaxed">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="bg-theme-secondary/40 py-14">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-serif italic font-bold text-2xl text-theme-primary text-center mb-10">Como funciona</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Cadastre sua fazenda', text: 'Propriedade, rebanho, talhões e financeiro — no seu ritmo, sem campo obrigatório travando você.' },
              { step: '2', title: 'Acompanhe no dia a dia', text: 'A Central de Obrigações e os alertas de clima avisam o que precisa da sua atenção, sem você precisar lembrar de nada.' },
              { step: '3', title: 'Decida com dado na mão', text: 'Relatórios, fluxo de caixa e o Consultor Rural te dão a visão de conjunto pra decidir com mais segurança.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--primary)] text-white font-bold text-lg flex items-center justify-center mx-auto mb-3">{s.step}</div>
                <h3 className="font-bold text-theme-primary text-sm mb-1.5">{s.title}</h3>
                <p className="text-xs text-theme-secondary">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="font-serif italic font-bold text-2xl text-theme-primary text-center mb-2">Escolha o plano do tamanho da sua operação</h2>
        <p className="text-theme-secondary text-sm text-center mb-10">3 dias grátis em qualquer plano, sem cartão — depois, mais 7 dias podendo cancelar sem cobrança.</p>
        <div className="grid md:grid-cols-4 gap-4">
          {([PlanTier.UMA_FAZENDA, PlanTier.TRES_FAZENDAS, PlanTier.CINCO_FAZENDAS] as PlanTier[]).map((plan, i) => (
            <div key={plan} className={`rounded-2xl border p-5 flex flex-col ${i === 1 ? 'border-[var(--primary)] shadow-lg relative' : 'border-theme'}`}>
              {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-white text-[10px] font-bold px-3 py-1 rounded-full">MAIS ESCOLHIDO</span>}
              <h3 className="font-bold text-theme-primary text-sm mb-1">{plan}</h3>
              <p className="text-2xl font-bold text-[var(--primary)] mb-4">R$ {PLAN_PRICES[plan]?.toFixed(2)}<span className="text-xs font-normal text-theme-secondary">/mês</span></p>
              <ul className="space-y-2 text-xs text-theme-secondary mb-6 flex-1">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[var(--primary)]" /> Todos os módulos inclusos</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[var(--primary)]" /> Central de Obrigações</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[var(--primary)]" /> Consultor Rural incluso</li>
              </ul>
              <button onClick={onStartTrial} className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white py-2.5 rounded-xl font-bold text-xs">
                Começar teste grátis
              </button>
            </div>
          ))}
          <div className="rounded-2xl border border-dashed border-theme p-5 flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-theme-primary text-sm mb-1">{PlanTier.AGRO_TOTAL}</h3>
            <p className="text-xs text-theme-secondary mb-4">Operações maiores, valor combinado com nossa equipe.</p>
            <a href="mailto:admmeuarmazem@gmail.com" className="text-xs font-bold text-[var(--primary)] underline">Fale conosco</a>
          </div>
        </div>
      </section>

      {/* Confiança */}
      <section className="bg-theme-secondary/40 py-10">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left">
          <ShieldCheck size={32} className="text-[var(--primary)] shrink-0" />
          <p className="text-sm text-theme-secondary">
            Não guardamos número de cartão nem dados bancários — o pagamento é processado direto pela página segura
            do Mercado Pago, Stripe ou PayPal. Seus dados de fazenda ficam isolados, acessíveis só por você.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 py-14">
        <h2 className="font-serif italic font-bold text-2xl text-theme-primary text-center mb-8">Perguntas frequentes</h2>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="border border-theme rounded-2xl overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                <span className="font-semibold text-sm text-theme-primary">{f.q}</span>
                <ChevronDown size={16} className={`text-theme-secondary shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && <p className="px-4 pb-4 text-xs text-theme-secondary">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[var(--primary)] py-14">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-serif italic font-bold text-2xl text-white mb-3">Pronto para organizar sua fazenda?</h2>
          <p className="text-white/80 text-sm mb-6">3 dias grátis, sem cartão. Cancele quando quiser.</p>
          <button onClick={onStartTrial} className="inline-flex items-center gap-2 bg-white text-[var(--primary)] px-6 py-3.5 rounded-xl font-bold text-sm shadow-md">
            Criar minha conta grátis <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
