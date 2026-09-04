/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { CloudRain, Wind, Thermometer, Snowflake } from 'lucide-react';
import { Property } from '../types';
import { fetchWeatherSnapshot, WeatherSnapshot, WeatherAlertItem } from '../lib/weatherRules';

const iconByType: Record<WeatherAlertItem['type'], typeof CloudRain> = {
  chuva_pulverizacao: CloudRain,
  vento_aplicacao_aerea: Wind,
  estresse_termico: Thermometer,
  risco_geada: Snowflake,
};

// Painel independente e aditivo: busca a previsão real (Open-Meteo,
// gratuito) para a propriedade ativa e mostra os alertas operacionais.
// Não bloqueia nada — é só um aviso visível no Dashboard.
export default function ClimaAlertsPanel({ activeProperty }: { activeProperty: Property | null }) {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProperty?.location) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchWeatherSnapshot(activeProperty.location.lat, activeProperty.location.lng)
      .then(setSnapshot)
      .catch(() => setError('Não foi possível buscar o clima agora.'))
      .finally(() => setLoading(false));
  }, [activeProperty?.location?.lat, activeProperty?.location?.lng]);

  if (!activeProperty?.location) {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-dashed border-gray-300 p-4">
        <p className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
          <CloudRain size={16} /> Alertas Climáticos
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Cadastre a localização da propriedade (em Propriedades → Editar → "Usar minha localização atual") para
          ativar os alertas de clima que influenciam pulverização, aplicação aérea e bem-estar animal.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm text-gray-400">Buscando previsão do tempo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <CloudRain size={16} /> Alertas Climáticos — hoje
      </h2>
      {snapshot.alerts.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-700 font-semibold">
            Sem restrições de clima hoje: {snapshot.tempMinToday.toFixed(0)}°–{snapshot.tempMaxToday.toFixed(0)}°C,
            {' '}{snapshot.precipitationToday.toFixed(0)}mm de chuva, ventos até {snapshot.windSpeedMaxToday.toFixed(0)}km/h.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {snapshot.alerts.map((a) => {
            const Icon = iconByType[a.type];
            const isUrgent = a.severity === 'urgente';
            return (
              <div
                key={a.type}
                className={`rounded-xl p-3 border flex items-start gap-2 ${
                  isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <Icon size={16} className={isUrgent ? 'text-red-600 shrink-0 mt-0.5' : 'text-amber-600 shrink-0 mt-0.5'} />
                <div>
                  <p className={`text-xs font-bold ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>{a.title}</p>
                  <p className={`text-xs ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>{a.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
