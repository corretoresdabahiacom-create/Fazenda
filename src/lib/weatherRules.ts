/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Motor de regras Clima -> Operações. Busca a previsão real (Open-Meteo,
// gratuito, mesma fonte usada pelo ClimaAgora) para a localização da
// propriedade ativa, e avalia condições que devem influenciar decisões
// operacionais — sem bloquear nada (o usuário sempre pode prosseguir),
// só avisando com destaque.

export type WeatherAlertType =
  | 'chuva_pulverizacao'
  | 'vento_aplicacao_aerea'
  | 'estresse_termico'
  | 'risco_geada';

export interface WeatherAlertItem {
  type: WeatherAlertType;
  severity: 'aviso' | 'urgente';
  title: string;
  message: string;
}

export interface WeatherSnapshot {
  fetchedAt: string;
  precipitationToday: number; // mm previstos para hoje
  windSpeedMaxToday: number; // km/h
  tempMaxToday: number; // °C
  tempMinToday: number; // °C
  alerts: WeatherAlertItem[];
}

// Limiares das regras — os mesmos valores definidos no planejamento do
// projeto (chuva > 15mm suspende pulverização, vento > 25km/h bloqueia
// aplicação aérea, temperatura > 35°C alerta estresse térmico animal,
// risco de geada com mínima prevista abaixo de 3°C).
const RAIN_THRESHOLD_MM = 15;
const WIND_THRESHOLD_KMH = 25;
const HEAT_STRESS_THRESHOLD_C = 35;
const FROST_RISK_THRESHOLD_C = 3;

export async function fetchWeatherSnapshot(lat: number, lng: number): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=precipitation_sum,windspeed_10m_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Não foi possível buscar a previsão do tempo agora.');
  const data = await res.json();

  const precipitationToday = data?.daily?.precipitation_sum?.[0] ?? 0;
  const windSpeedMaxToday = data?.daily?.windspeed_10m_max?.[0] ?? 0;
  const tempMaxToday = data?.daily?.temperature_2m_max?.[0] ?? 0;
  const tempMinToday = data?.daily?.temperature_2m_min?.[0] ?? 0;

  const alerts: WeatherAlertItem[] = [];

  if (precipitationToday > RAIN_THRESHOLD_MM) {
    alerts.push({
      type: 'chuva_pulverizacao',
      severity: 'aviso',
      title: 'Chuva forte prevista para hoje',
      message: `${precipitationToday.toFixed(0)}mm de chuva previstos — considere suspender a pulverização hoje.`,
    });
  }

  if (windSpeedMaxToday > WIND_THRESHOLD_KMH) {
    alerts.push({
      type: 'vento_aplicacao_aerea',
      severity: 'aviso',
      title: 'Vento forte previsto para hoje',
      message: `Rajadas de até ${windSpeedMaxToday.toFixed(0)}km/h — evite aplicação aérea ou pulverização hoje.`,
    });
  }

  if (tempMaxToday > HEAT_STRESS_THRESHOLD_C) {
    alerts.push({
      type: 'estresse_termico',
      severity: 'aviso',
      title: 'Risco de estresse térmico animal',
      message: `Máxima prevista de ${tempMaxToday.toFixed(0)}°C — garanta sombra e água para o rebanho hoje.`,
    });
  }

  if (tempMinToday < FROST_RISK_THRESHOLD_C) {
    alerts.push({
      type: 'risco_geada',
      severity: 'urgente',
      title: 'Risco de geada',
      message: `Mínima prevista de ${tempMinToday.toFixed(1)}°C — risco de geada esta noite/madrugada.`,
    });
  }

  return {
    fetchedAt: new Date().toISOString(),
    precipitationToday,
    windSpeedMaxToday,
    tempMaxToday,
    tempMinToday,
    alerts,
  };
}
