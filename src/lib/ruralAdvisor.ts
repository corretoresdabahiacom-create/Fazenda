/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Consultor Rural baseado em regras — sem nenhuma chamada a API de IA
// externa. Reconhece um conjunto de perguntas comuns por palavra-chave e
// responde com os dados reais já cadastrados no sistema. 100% gratuito,
// instantâneo, e nunca depende de nenhuma chave de API configurada.

import { WeatherSnapshot } from './weatherRules';
import { AccountPayable, AccountReceivable, Talhao, IndividualAnimal, TalhaoStatus, AccountStatus } from '../types';

export interface AdvisorContext {
  weather: WeatherSnapshot | null;
  accountsPayable: AccountPayable[];
  accountsReceivable: AccountReceivable[];
  talhoes: Talhao[];
  individualAnimals: IndividualAnimal[];
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

  // ---- Não reconheceu a pergunta ----
  return {
    answer:
      'Não entendi bem essa pergunta. Posso responder sobre: se pode pulverizar hoje, clima do dia, risco de geada/calor, saldo financeiro, quantos talhões estão ativos, ou quantos animais você tem cadastrados. Tenta reformular usando uma dessas palavras.',
    basedOnRealData: false,
  };
}
