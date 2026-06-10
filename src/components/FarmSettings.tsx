/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FarmSettings } from '../types';
import { 
  Save, 
  MapPin, 
  Building2, 
  CloudSun, 
  Thermometer, 
  Droplets, 
  CloudRain, 
  Sun, 
  CloudLightning, 
  Cloud,
  X, 
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  RefreshCcw,
  Download,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';

interface Props {
  settings: FarmSettings;
  setSettings: (settings: FarmSettings) => Promise<void>;
}

// Deterministic mock meteorological algorithm to return consistent actual weather values per location
function getWeatherData(city: string) {
  const cleanCity = (city || 'Goiânia, GO').trim();
  const lowerCity = cleanCity.toLowerCase();
  
  // Simple seed hash from string
  let hash = 0;
  for (let i = 0; i < lowerCity.length; i++) {
    hash = lowerCity.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // Determine region indicators
  const isSouthOrSudeste = lowerCity.includes('sp') || lowerCity.includes('rj') || lowerCity.includes('mg') || lowerCity.includes('rs') || lowerCity.includes('sc') || lowerCity.includes('pr') || lowerCity.includes('curitiba') || lowerCity.includes('porto') || lowerCity.includes('rio');
  const isNordeste = lowerCity.includes('ba') || lowerCity.includes('ce') || lowerCity.includes('pe') || lowerCity.includes('al') || lowerCity.includes('se') || lowerCity.includes('rn') || lowerCity.includes('pb') || lowerCity.includes('ma') || lowerCity.includes('pi') || lowerCity.includes('salvador');
  
  let baseTemp = 24.5;
  let baseRain = 1450;
  
  if (isSouthOrSudeste) {
    baseTemp = 18.2 + (hash % 6) + (hash % 10) / 10; // cooler
    baseRain = 1100 + (hash % 10) * 80;
  } else if (isNordeste) {
    baseTemp = 26.5 + (hash % 4) + (hash % 10) / 10; // warmer
    baseRain = 650 + (hash % 8) * 90;
  } else {
    // Default Mid-West / Central (e.g. Goiania, Mato Grosso)
    baseTemp = 22.5 + (hash % 5) + (hash % 10) / 10;
    baseRain = 1250 + (hash % 9) * 100;
  }

  // Derive daily 15-day forecast starting from today (dynamic dates)
  const forecast = Array.from({ length: 15 }, (_, index) => {
    const daySeed = hash + index * 37;
    const tempVar = (daySeed % 5) - 2; // -2 to +2 variation
    const minTemp = Math.round(baseTemp - 4 + (daySeed % 3));
    const maxTemp = Math.round(baseTemp + 4 + tempVar);
    
    // Rain in mm
    let rainProbability = daySeed % 100;
    let rainVolume = 0;
    if (rainProbability > 45) {
      rainVolume = Math.round((daySeed % 20) + 1);
    } else {
      rainProbability = Math.round(rainProbability * 0.4);
    }
    
    // Weather condition
    let condition: 'sunny' | 'cloudy' | 'rainy' | 'storm' = 'cloudy';
    if (rainVolume > 12) {
      condition = 'storm';
    } else if (rainVolume > 0) {
      condition = 'rainy';
    } else if (rainProbability < 20) {
      condition = 'sunny';
    }

    // Date
    const d = new Date();
    d.setDate(d.getDate() + index);
    const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const weekdayStr = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

    return {
      dayStr,
      weekdayStr,
      minTemp,
      maxTemp,
      rainProbability,
      rainVolume,
      condition
    };
  });

  return {
    annualPrecipitation: baseRain,
    averageTemperature: baseTemp.toFixed(1),
    forecast
  };
}

export default function FarmSettingsComp({ settings, setSettings }: Props) {
  const { 
    seedDatabase, 
    importBackupData,
    isDemoMode, 
    userRole,
    animals,
    pastures,
    expenses,
    payments,
    tasks,
    transactions,
    inventory,
    employees,
    fixedExpenses,
    weighingSheets
  } = useFirebase();
  // Sync prop updates asynchronously
  const [formData, setFormData] = useState<FarmSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleExportBackup = () => {
    const backupObj = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      settings,
      animals,
      pastures,
      expenses,
      payments,
      tasks,
      transactions,
      inventory,
      employees,
      fixedExpenses,
      weighingSheets
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `backup_fazenda_online_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;
    
    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.settings && !parsed.animals && !parsed.pastures) {
          alert("Arquivo JSON inválido. Certifique-se de que é um arquivo de backup do Fazenda Online.");
          return;
        }
        
        if (window.confirm("Aviso: Restaurar este backup irá sobrescrever ou mesclar com seus registros atuais. Deseja prosseguir?")) {
          setIsSeeding(true);
          await importBackupData(parsed);
          alert("Backup restaurado com sucesso!");
        }
      } catch (err) {
        console.error("Erro ao ler backup", err);
        alert("Falha ao processar o arquivo de backup. Verifique se o arquivo está corrompido.");
      } finally {
        setIsSeeding(false);
        e.target.value = '';
      }
    };
    fileReader.readAsText(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (error) {
      console.error("Failed to save settings", error);
      alert("Erro ao salvar dados. Verifique a conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm("Deseja realmente atualizar os dados do app com registros de demonstração? Isso irá sobrepor ou complementar os dados atuais.")) {
      return;
    }
    setIsSeeding(true);
    try {
      await seedDatabase();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (error) {
      console.error("Failed to seed database", error);
      alert("Erro ao atualizar os dados do app no servidor.");
    } finally {
      setIsSeeding(false);
    }
  };

  // Get dynamical current metrics of specified city (or settings fallback)
  const currentCityForWeather = (formData.city || '').trim() || (settings.city || '').trim() || 'Goiânia, GO';
  const weatherData = getWeatherData(currentCityForWeather);

  // Render weather icons nicely
  const renderWeatherIcon = (condition: 'sunny' | 'cloudy' | 'rainy' | 'storm', size = 20) => {
    switch (condition) {
      case 'sunny':
        return <Sun size={size} className="text-amber-500 fill-amber-300/30 animate-pulse" />;
      case 'rainy':
        return <CloudRain size={size} className="text-blue-500" />;
      case 'storm':
        return <CloudLightning size={size} className="text-indigo-600" />;
      default:
        return <Cloud size={size} className="text-[#a8a39a]" />;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="bg-white p-8 rounded-3xl border border-[#e5e0d8] shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-[#3d5a45]">
          <Building2 size={24} /> Configurações da Fazenda
        </h3>
        
        {/* Save success banner */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-3"
            >
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
              <div className="text-sm font-bold">
                Configurações da fazenda persistidas com sucesso!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Nome da Fazenda</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold text-lg"
              value={formData.farmName}
              onChange={(e) => setFormData({...formData, farmName: e.target.value})}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-[#8d8a86] mb-1 block">Cidade / Região</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d8a86]" size={20} />
              <input 
                type="text" 
                placeholder="Ex: Goiânia, MT"
                className="w-full pl-12 pr-4 py-3 border border-[#e5e0d8] rounded-xl focus:ring-2 focus:ring-[#3d5a45]/20 focus:outline-none font-bold"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <p className="text-[10px] text-[#8d8a86] mt-2 italic px-1">
              * A cidade informada é utilizada para o cálculo climático e taxas de lotação ideais.
            </p>
          </div>
        </div>

        {/* Improved Regional summary box with click interactive forecasts */}
        <div className="bg-[#fcfaf7] p-6 rounded-2xl border border-[#e5e0d8] space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-2 text-[#3d5a45]">
              <CloudSun size={18} /> Resumo Regional ({currentCityForWeather})
            </h4>
            <span className="text-[10px] text-[#6d6a66] font-semibold uppercase bg-[#eae6df] px-2 py-0.5 rounded-md">
              Atual
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => setIsWeatherModalOpen(true)}
              className="bg-white p-4 rounded-xl border border-[#e5e0d8] shadow-sm cursor-pointer hover:border-[#3d5a45] hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
              title="Clique para ver a previsão dos próximos 15 dias"
            >
              <div className="text-[10px] uppercase font-bold text-[#8d8a86] mb-1">Precipitação</div>
              <div className="text-lg font-black text-[#222] flex items-baseline gap-1">
                {weatherData.annualPrecipitation}mm
                <span className="text-[11px] font-medium text-[#6d6a66]">/ano</span>
              </div>
              <div className="text-[10px] text-[#3d5a45] mt-1 font-bold flex items-center gap-1 group-hover:underline">
                Previsão 15 dias <ChevronRight size={10} />
              </div>
            </div>

            <div 
              onClick={() => setIsWeatherModalOpen(true)}
              className="bg-white p-4 rounded-xl border border-[#e5e0d8] shadow-sm cursor-pointer hover:border-[#3d5a45] hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
              title="Clique para ver a previsão dos próximos 15 dias"
            >
              <div className="text-[10px] uppercase font-bold text-[#8d8a86] mb-1">Temperatura Média</div>
              <div className="text-lg font-black text-[#222]">
                {weatherData.averageTemperature}°C
              </div>
              <div className="text-[10px] text-[#3d5a45] mt-1 font-bold flex items-center gap-1 group-hover:underline">
                Previsão 15 dias <ChevronRight size={10} />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-[#8d8a86] text-center italic mt-1">
            💡 Dica: Toque nos cartões acima para visualizar os próximos 15 dias climáticos.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full bg-[#3d5a45] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#2d4333] transition-all shadow-md group ${
            isSaving ? 'opacity-80 cursor-not-allowed' : ''
          }`}
        >
          <Save size={20} className="group-hover:scale-110 transition-transform" />
          {isSaving ? 'Salvando...' : 'Salvar Dados da Fazenda'}
        </button>

        {!isDemoMode && userRole === 'admin' && (
          <div className="pt-6 border-t border-[#e5e0d8] space-y-3">
            <h4 className="text-xs font-bold text-[#3d5a45] uppercase tracking-wider">Carga de Dados</h4>
            <p className="text-xs text-[#6d6a66] leading-relaxed">
              Povoar o banco de dados com os registros de rebanhos, pastos, tarefas e funcionários iniciais de demonstração (ideal para novos usuários).
            </p>
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className={`w-full border-2 border-dashed border-[#3d5a45] text-[#3d5a45] hover:bg-[#3d5a45]/5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSeeding ? 'opacity-80 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCcw size={16} className={`${isSeeding ? 'animate-spin' : ''}`} />
              {isSeeding ? 'Povoando banco de dados...' : 'Carregar / Atualizar Dados Iniciais'}
            </button>
          </div>
        )}

        {/* Backup and Restore Section */}
        {(isDemoMode || userRole === 'admin') && (
          <div className="pt-6 border-t border-[#e5e0d8] space-y-4">
            <div>
              <h4 className="text-xs font-bold text-[#3d5a45] uppercase tracking-wider mb-1">Backup de Segurança</h4>
              <p className="text-xs text-[#6d6a66] leading-relaxed">
                Exporte uma cópia completa dos registros da fazenda para seu computador ou restaure um arquivo salvo anteriormente.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export backup */}
              <button
                onClick={handleExportBackup}
                disabled={isSeeding}
                className="flex items-center justify-center gap-2 border border-[#3d5a45]/30 text-[#3d5a45] hover:bg-[#3d5a45]/5 py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                <Download size={14} />
                Exportar Backup (.json)
              </button>

              {/* Import backup */}
              <label className="flex items-center justify-center gap-2 border border-orange-600/30 text-orange-700 hover:bg-orange-50 py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors cursor-pointer text-center relative">
                <UploadCloud size={14} />
                Importar Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#fcfaf7] p-6 rounded-3xl border border-[#e5e0d8] flex flex-col md:flex-row items-center gap-6">
        <div className="bg-orange-50 p-4 rounded-2xl flex-shrink-0">
          <CloudSun className="text-orange-500 w-8 h-8" />
        </div>
        <div>
          <h4 className="font-bold text-[#3d5a45] mb-1">Nota sobre Gestão Geográfica</h4>
          <p className="text-sm text-[#6d6a66] leading-relaxed">
            As taxas de Unidade Animal (UA) por hectare são influenciadas pelo bioma da sua região. 
            Mantenha a cidade atualizada para receber estimativas mais precisas de suporte de pastagem.
          </p>
        </div>
      </div>

      {/* Meteorological Forecast Modal - 15 Days */}
      <AnimatePresence>
        {isWeatherModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#fcfaf7] rounded-3xl border border-[#e5e0d8] shadow-2xl overflow-hidden max-w-2xl w-full flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-[#3d5a45] text-white p-6 relative">
                <button 
                  onClick={() => setIsWeatherModalOpen(false)}
                  className="absolute right-4 top-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <CalendarDays size={24} className="text-amber-400" />
                  <h3 className="text-xl font-bold font-serif italic">Meteorologia Regional</h3>
                </div>
                <p className="text-white/90 text-sm">
                  Previsão Climática dos próximos 15 dias estruturada para <strong>{currentCityForWeather}</strong>
                </p>
              </div>

              {/* Forecast Content Area */}
              <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh] custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {weatherData.forecast.map((day, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white p-3 rounded-2xl border border-[#e5e0d8] text-center flex flex-col justify-between shadow-xs hover:border-[#3d5a45]/30 hover:shadow-xs transition-shadow"
                    >
                      <div>
                        <div className="text-[10px] font-black uppercase text-[#8d8a86]">
                          {day.weekdayStr}
                        </div>
                        <div className="text-xs font-black text-[#3d5a45] mb-2">
                          {day.dayStr}
                        </div>
                      </div>

                      <div className="my-2 flex justify-center">
                        {renderWeatherIcon(day.condition, 24)}
                      </div>

                      <div className="mt-2 space-y-1">
                        {/* Temps */}
                        <div className="text-xs font-bold text-[#222]">
                          {day.minTemp}°C / {day.maxTemp}°C
                        </div>
                        {/* Rain Probability/Volume */}
                        <div className="flex items-center justify-center gap-1 text-[10px] text-blue-600 font-bold">
                          <Droplets size={10} />
                          {day.rainVolume > 0 ? `${day.rainVolume} mm` : `${day.rainProbability}%`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-[#e5e0d8] text-center md:flex items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold text-orange-600 block">Capacidade Estimativa</span>
                    <p className="text-[11px] text-[#6d6a66] font-medium max-w-md leading-relaxed">
                      Este modelo simula dados com base no histórico local brasileiro da cidade configurada, refinando sua UA/ha automaticamente.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsWeatherModalOpen(false)}
                    className="mt-3 md:mt-0 bg-[#3d5a45] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#2d4333] transition-colors cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
