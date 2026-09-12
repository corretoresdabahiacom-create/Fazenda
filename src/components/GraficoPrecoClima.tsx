/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface ChartPoint { label: string; data: string; chuvaMm: number | null; preco: number | null }
interface ChartResponse {
  local: string; granularidade: 'mes' | 'dia'; pontos: ChartPoint[]; avisoPreco?: string; error?: string;
}

interface Props {
  produto: string;
  produtoLabel: string;
  estado: string;
  cidade: string;
}

function calcularTendencia(valores: (number | null)[]): (number | null)[] {
  const indices: number[] = [];
  const ys: number[] = [];
  valores.forEach((v, i) => { if (v != null) { indices.push(i); ys.push(v); } });
  if (indices.length < 2) return valores.map(() => null);

  const n = indices.length;
  const somaX = indices.reduce((a, b) => a + b, 0);
  const somaY = ys.reduce((a, b) => a + b, 0);
  const somaXY = indices.reduce((acc, x, i) => acc + x * ys[i], 0);
  const somaX2 = indices.reduce((acc, x) => acc + x * x, 0);
  const denom = n * somaX2 - somaX * somaX;
  if (denom === 0) return valores.map(() => null);
  const slope = (n * somaXY - somaX * somaY) / denom;
  const intercept = (somaY - slope * somaX) / n;

  return valores.map((_, i) => Number((slope * i + intercept).toFixed(2)));
}

function useChartData(produto: string, estado: string, cidade: string, inicio: string, fim: string) {
  const [dados, setDados] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estado && !cidade) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ produto, estado, cidade, inicio, fim });
    fetch(`/api/climate-price-chart?${params}`)
      .then(res => res.json())
      .then(json => { if (json.error) setError(json.error); else setDados(json); })
      .catch(() => setError('Não foi possível montar o gráfico agora.'))
      .finally(() => setLoading(false));
  }, [produto, estado, cidade, inicio, fim]);

  return { dados, loading, error };
}

function GraficoIndividual({ titulo, dados }: { titulo: string; dados: ChartResponse | null }) {
  if (!dados || dados.pontos.length === 0) return null;

  const chuvaTendencia = calcularTendencia(dados.pontos.map(p => p.chuvaMm));
  const precoTendencia = calcularTendencia(dados.pontos.map(p => p.preco));
  const chartData = dados.pontos.map((p, i) => ({
    ...p,
    chuvaTendencia: chuvaTendencia[i],
    precoTendencia: precoTendencia[i],
  }));

  return (
    <div className="bg-theme-card rounded-2xl border border-theme p-4 shadow-theme">
      <p className="text-xs font-bold text-theme-primary mb-1">{titulo}</p>
      <p className="text-[10px] text-theme-secondary mb-3">{dados.local} · {dados.granularidade === 'mes' ? 'por mês' : 'por dia'}</p>
      {dados.avisoPreco && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 dark:text-amber-300">{dados.avisoPreco}</p>
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="chuva" tick={{ fontSize: 10 }} label={{ value: 'mm', angle: -90, fontSize: 10 }} />
          <YAxis yAxisId="preco" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'R$', angle: 90, fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar yAxisId="chuva" dataKey="chuvaMm" name="Chuva (mm)" fill="#60a5fa" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="preco" dataKey="preco" name="Preço (R$)" fill="#34d399" radius={[3, 3, 0, 0]} />
          <Line yAxisId="chuva" type="monotone" dataKey="chuvaTendencia" name="Tendência clima" stroke="#1d4ed8" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          <Line yAxisId="preco" type="monotone" dataKey="precoTendencia" name="Tendência preço" stroke="#047857" strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function GraficoPrecoClima({ produto, produtoLabel, estado, cidade }: Props) {
  const anoAtual = new Date().getFullYear();
  const hoje = new Date();
  const daqui16Dias = new Date(hoje.getTime() + 16 * 86400000);

  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  const dataFimMax = daqui16Dias.toISOString().slice(0, 10);

  const inicioAnoPassado = dataInicio.replace(String(anoAtual), String(anoAtual - 1));
  const fimAnoPassado = dataFim.replace(new RegExp(`^\\d{4}`), String(new Date(dataFim).getFullYear() - 1));

  const atual = useChartData(produto, estado, cidade, dataInicio, dataFim);
  const anoPassado = useChartData(produto, estado, cidade, inicioAnoPassado, fimAnoPassado);

  if (!estado && !cidade) {
    return <p className="text-xs text-theme-secondary bg-theme-card border border-theme rounded-2xl p-4 shadow-theme">Escolha um estado ou cidade acima pra ver o gráfico de preço x clima.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="bg-theme-card rounded-2xl border border-theme p-3 flex flex-wrap items-end gap-3 shadow-theme">
        <div>
          <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="text-xs border border-theme rounded-lg px-2 py-1.5" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Até</label>
          <input type="date" value={dataFim} max={dataFimMax} onChange={e => setDataFim(e.target.value)} className="text-xs border border-theme rounded-lg px-2 py-1.5" />
        </div>
        <p className="text-[10px] text-theme-secondary">Previsão de clima disponível até {new Date(dataFimMax).toLocaleDateString('pt-BR')} (limite de 16 dias à frente do Open-Meteo). Selecione só um mês pra ver o detalhe por dia.</p>
      </div>

      {atual.loading && <p className="text-xs text-theme-secondary text-center py-6">Montando o gráfico...</p>}
      {atual.error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">{atual.error}</p>}
      <GraficoIndividual titulo={`${produtoLabel} × Clima — período selecionado`} dados={atual.dados} />

      {anoPassado.error && <p className="text-xs text-theme-secondary">Não foi possível comparar com o ano passado agora.</p>}
      <GraficoIndividual titulo={`${produtoLabel} × Clima — mesmo período, ano anterior`} dados={anoPassado.dados} />
    </div>
  );
}
