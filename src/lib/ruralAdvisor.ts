/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Consultor Rural baseado em regras — sem nenhuma chamada a API de IA
// externa. Reconhece um conjunto de perguntas comuns por palavra-chave e
// responde com os dados reais já cadastrados no sistema. 100% gratuito,
// instantâneo, e nunca depende de nenhuma chave de API configurada.

import { WeatherSnapshot } from './weatherRules';
import {
  AccountPayable, AccountReceivable, Talhao, IndividualAnimal, TalhaoStatus, AccountStatus,
  ReproductionEvent, HealthEvent, MilkProductionRecord, FarmDocument, Machine, MaintenanceRecord,
  InventoryItem,
} from '../types';
import { differenceInCalendarDays, format } from 'date-fns';

export interface AdvisorContext {
  weather: WeatherSnapshot | null;
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

export interface AdvisorAnswer {
  answer: string;
  basedOnRealData: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos, pra "não" e "nao" darem match igual
}

export function answerRuralQuestion(question: string, ctx: AdvisorContext): AdvisorAnswer {
  const q = normalize(question);

  // ---- Pulverização / vento / clima operacional ----
  if (
    q.includes('pulveriz') || q.includes('aplicar defensivo') || q.includes('aplicacao aerea') ||
    q.includes('aplicacao foliar') || (q.includes('chuva') && (q.includes('hoje') || q.includes('pode')))
  ) {
    if (!ctx.weather) {
      return {
        answer: 'Não tenho o clima de hoje porque a propriedade ativa ainda não tem localização cadastrada. Vá em Propriedades → editar → "Usar minha localização atual" para eu conseguir responder isso.',
        basedOnRealData: false,
      };
    }
    const relevant = ctx.weather.alerts.filter(a => a.type === 'chuva_pulverizacao' || a.type === 'vento_aplicacao_aerea');
    if (relevant.length > 0) {
      return {
        answer: `Hoje não é recomendado pulverizar: ${relevant.map(a => a.message).join(' ')}`,
        basedOnRealData: true,
      };
    }
    return {
      answer: `Hoje o clima está favorável para pulverização: máxima de ${ctx.weather.tempMaxToday.toFixed(0)}°C, ${ctx.weather.precipitationToday.toFixed(0)}mm de chuva prevista, ventos até ${ctx.weather.windSpeedMaxToday.toFixed(0)}km/h — dentro dos limites seguros.`,
      basedOnRealData: true,
    };
  }

  // ---- Estresse térmico / calor animal ----
  if (q.includes('calor') || q.includes('estresse termico') || (q.includes('temperatura') && q.includes('animal'))) {
    if (!ctx.weather) {
      return { answer: 'Não tenho o clima de hoje — cadastre a localização da propriedade em Propriedades para eu poder avisar sobre estresse térmico.', basedOnRealData: false };
    }
    const heatAlert = ctx.weather.alerts.find(a => a.type === 'estresse_termico');
    if (heatAlert) {
      return { answer: heatAlert.message, basedOnRealData: true };
    }
    return {
      answer: `Sem risco de estresse térmico hoje — máxima prevista de ${ctx.weather.tempMaxToday.toFixed(0)}°C.`,
      basedOnRealData: true,
    };
  }

  // ---- Geada ----
  if (q.includes('geada')) {
    if (!ctx.weather) {
      return { answer: 'Não tenho o clima de hoje — cadastre a localização da propriedade para eu poder avisar sobre risco de geada.', basedOnRealData: false };
    }
    const frostAlert = ctx.weather.alerts.find(a => a.type === 'risco_geada');
    if (frostAlert) return { answer: frostAlert.message, basedOnRealData: true };
    return { answer: `Sem risco de geada hoje — mínima prevista de ${ctx.weather.tempMinToday.toFixed(1)}°C.`, basedOnRealData: true };
  }

  // ---- Clima geral ----
  if (q.includes('clima') || q.includes('tempo') || q.includes('previsao')) {
    if (!ctx.weather) {
      return { answer: 'Não tenho o clima de hoje — cadastre a localização da propriedade ativa em Propriedades para eu conseguir mostrar isso.', basedOnRealData: false };
    }
    const alertText = ctx.weather.alerts.length > 0
      ? ` Alertas: ${ctx.weather.alerts.map(a => a.title).join(', ')}.`
      : ' Sem alertas hoje.';
    return {
      answer: `Hoje: mínima ${ctx.weather.tempMinToday.toFixed(0)}°C, máxima ${ctx.weather.tempMaxToday.toFixed(0)}°C, ${ctx.weather.precipitationToday.toFixed(0)}mm de chuva prevista, ventos até ${ctx.weather.windSpeedMaxToday.toFixed(0)}km/h.${alertText}`,
      basedOnRealData: true,
    };
  }

  // ---- Financeiro / saldo ----
  if (
    q.includes('saldo') || q.includes('financeiro') || q.includes('lucro') ||
    q.includes('a pagar') || q.includes('a receber') || q.includes('dinheiro') || q.includes('caixa')
  ) {
    const totalPagar = ctx.accountsPayable.filter(a => a.status !== AccountStatus.PAGO).reduce((s, a) => s + (a.value ?? 0), 0);
    const totalReceber = ctx.accountsReceivable.filter(a => a.status !== AccountStatus.PAGO).reduce((s, a) => s + (a.value ?? 0), 0);
    const saldo = totalReceber - totalPagar;
    return {
      answer: `Você tem R$ ${totalPagar.toFixed(2)} a pagar e R$ ${totalReceber.toFixed(2)} a receber (contas pendentes). Saldo projetado: R$ ${saldo.toFixed(2)}${saldo >= 0 ? ' (positivo)' : ' (negativo, atenção)'}.`,
      basedOnRealData: true,
    };
  }

  // ---- Talhões ----
  if (q.includes('talhao') || q.includes('talhoes')) {
    if (ctx.talhoes.length === 0) {
      return { answer: 'Você ainda não tem nenhum talhão cadastrado. Vá em Agricultura → Talhões para cadastrar.', basedOnRealData: true };
    }
    const ativos = ctx.talhoes.filter(t => t.status === TalhaoStatus.ATIVO);
    const nomes = ativos.map(t => t.name).join(', ') || 'nenhum';
    return {
      answer: `Você tem ${ctx.talhoes.length} talhão(ões) cadastrado(s), sendo ${ativos.length} ativo(s): ${nomes}.`,
      basedOnRealData: true,
    };
  }

  // ---- Rebanho / animais ----
  if (q.includes('animal') || q.includes('rebanho') || q.includes('gado') || q.includes('vaca') || q.includes('boi') || q.includes('lote')) {
    if (ctx.individualAnimals.length === 0) {
      return { answer: 'Você ainda não tem nenhum animal cadastrado individualmente. Vá em Pecuária Profissional → Cadastro Individual.', basedOnRealData: true };
    }
    const ativos = ctx.individualAnimals.filter(a => a.status === 'active');
    return {
      answer: `Você tem ${ctx.individualAnimals.length} animal(is) cadastrado(s) individualmente, sendo ${ativos.length} ativo(s) no rebanho.`,
      basedOnRealData: true,
    };
  }

  // ---- Reprodução / parto ----
  if (q.includes('parto') || q.includes('prenh') || q.includes('gestacao') || q.includes('cria')) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const upcoming = ctx.reproductionEvents
      .filter(e => e.expectedBirthDate && e.expectedBirthDate >= today)
      .sort((a, b) => (a.expectedBirthDate! < b.expectedBirthDate! ? -1 : 1));
    if (upcoming.length === 0) {
      return { answer: 'Não encontrei nenhuma previsão de parto futura cadastrada. Registre uma cobertura, inseminação ou IATF em Pecuária Profissional → Reprodução para eu calcular isso automaticamente.', basedOnRealData: true };
    }
    const next = upcoming[0];
    const dias = differenceInCalendarDays(new Date(next.expectedBirthDate!), new Date());
    return {
      answer: `A próxima com previsão de parto é o animal ${next.animalEarTag}, previsto para ${format(new Date(next.expectedBirthDate!), 'dd/MM/yyyy')} (em ${dias} dias). ${upcoming.length > 1 ? `Tem mais ${upcoming.length - 1} previsão(ões) futura(s).` : ''}`,
      basedOnRealData: true,
    };
  }

  // ---- Sanidade / vacina ----
  if (q.includes('vacina') || q.includes('vermifug') || q.includes('sanidade') || q.includes('reforco')) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const upcoming = ctx.healthEvents
      .filter(e => e.nextDoseDate && e.nextDoseDate >= today)
      .sort((a, b) => (a.nextDoseDate! < b.nextDoseDate! ? -1 : 1));
    if (upcoming.length === 0) {
      return { answer: 'Não encontrei nenhum reforço de vacina/vermífugo pendente cadastrado.', basedOnRealData: true };
    }
    const next = upcoming[0];
    return {
      answer: `O próximo reforço é para o animal ${next.animalEarTag} (${next.productName}), em ${format(new Date(next.nextDoseDate!), 'dd/MM/yyyy')}. ${upcoming.length > 1 ? `Tem mais ${upcoming.length - 1} pendente(s).` : ''}`,
      basedOnRealData: true,
    };
  }

  // ---- Produção leiteira ----
  if (q.includes('leite') || q.includes('producao leiteira') || q.includes('ordenha')) {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const thisMonth = ctx.milkRecords.filter(r => r.date.startsWith(currentMonth));
    const total = thisMonth.reduce((s, r) => s + r.liters, 0);
    if (thisMonth.length === 0) {
      return { answer: 'Nenhum registro de produção leiteira neste mês ainda. Registre em Pecuária Profissional → Produção Leiteira.', basedOnRealData: true };
    }
    return { answer: `Produção total registrada este mês: ${total.toFixed(1)} litros, em ${thisMonth.length} registro(s).`, basedOnRealData: true };
  }

  // ---- Documentos vencendo ----
  if (q.includes('documento') || q.includes('car') || q.includes('licenca') || q.includes('itr') || q.includes('ccir')) {
    const today = new Date();
    const expiring = ctx.documents.filter(d => d.expirationDate && differenceInCalendarDays(new Date(d.expirationDate), today) <= 30);
    if (expiring.length === 0) {
      return { answer: `Você tem ${ctx.documents.length} documento(s) cadastrado(s), nenhum vencendo nos próximos 30 dias.`, basedOnRealData: true };
    }
    return {
      answer: `Atenção: ${expiring.map(d => `${d.title} vence em ${format(new Date(d.expirationDate!), 'dd/MM/yyyy')}`).join('; ')}.`,
      basedOnRealData: true,
    };
  }

  // ---- Máquinas / manutenção ----
  if (q.includes('maquina') || q.includes('trator') || q.includes('manutencao') || q.includes('revisao')) {
    if (ctx.machines.length === 0) {
      return { answer: 'Você ainda não tem nenhuma máquina cadastrada. Vá em Máquinas → Cadastro.', basedOnRealData: true };
    }
    const pending = ctx.maintenanceRecords.filter(m => {
      const machine = ctx.machines.find(mm => mm.id === m.machineId);
      return machine?.hourMeter != null && m.nextServiceHourMeter != null && machine.hourMeter >= m.nextServiceHourMeter;
    });
    if (pending.length === 0) {
      return { answer: `Você tem ${ctx.machines.length} máquina(s) cadastrada(s), nenhuma com manutenção pendente pelo horímetro atual.`, basedOnRealData: true };
    }
    return { answer: `Atenção: ${pending.length} máquina(s) já passaram do horímetro previsto para a próxima revisão.`, basedOnRealData: true };
  }

  // ---- Estoque ----
  if (q.includes('estoque') || q.includes('insumo') || q.includes('racao') || q.includes('acabando')) {
    const critical = ctx.inventory.filter(i => i.criticalStock != null && i.quantity <= i.criticalStock);
    const low = ctx.inventory.filter(i => i.minStock != null && i.quantity <= i.minStock && !critical.includes(i));
    if (critical.length === 0 && low.length === 0) {
      return { answer: `Estoque de ${ctx.inventory.length} item(ns), sem nenhum alerta de mínimo/crítico no momento.`, basedOnRealData: true };
    }
    return {
      answer: `Atenção no estoque: ${critical.map(i => `${i.name} (crítico: ${i.quantity} ${i.unit})`).join(', ')}${critical.length && low.length ? '; ' : ''}${low.map(i => `${i.name} (baixo: ${i.quantity} ${i.unit})`).join(', ')}.`,
      basedOnRealData: true,
    };
  }

  // ---- Não reconheceu a pergunta ----
  return {
    answer:
      'Não entendi bem essa pergunta. Posso responder sobre: clima/pulverização hoje, risco de geada/calor, saldo financeiro, talhões ativos, quantidade de animais, previsão de parto, vacinas pendentes, produção de leite, documentos vencendo, manutenção de máquinas, ou estoque baixo. Tenta reformular usando um desses temas.',
    basedOnRealData: false,
  };
}
