/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { AlertTriangle, Settings2 } from 'lucide-react';
import HistoricoPrecoPessoal from './HistoricoPrecoPessoal';

interface ChartPoint { label: string; data: string; chuvaMm: number | null; preco: number | null }
interface ChartResponse {
  local: string; granularidade: 'mes' | 'dia'; pontos: ChartPoint[]; avisoPreco?: string; error?: string; fonteClima?: string; fontePreco?: string; avisoIpea?: string; unidadePreco?: string | null;
}

// "BRL/@" -> "R$/@", "USD/saca60" -> "US$/saca 60kg", "BRL/?" -> "R$"
function rotuloUnidade(u?: string | null): string {
  if (!u) return 'R$';
  const [moeda, medida] = u.split('/');
  const simbolo = moeda === 'USD' ? 'US$' : 'R$';
  const nomes: Record<string, string> = { '@': '@', saca60: 'saca 60kg', kg: 'kg', t: 't', l: 'litro', dz: 'dúzia', cx: 'caixa' };
  return medida && nomes[medida] ? `${simbolo}/${nomes[medida]}` : simbolo;
}

interface Props {
  produto: string;
  produtoLabel: string;
  estado: string;
  cidade: string;
}

// Lista de produtos pra tela de configuração do gráfico — o usuário
// escolhe explicitamente o que quer ver, em vez de herdar sem avisar o
// que estava selecionado lá em cima na tela de Cotações.
// LISTA ALINHADA COM A COBERTURA REAL. Os números vieram do catálogo
// do arquivo da CONAB (1.173 produtos), não de estimativa. Cada rótulo
// mostra em quantos estados existe série histórica, pra pessoa escolher
// sabendo o que vai encontrar.
//
// Removidos de propósito: Vaca, Novilho e Novilha. O catálogo mostrou
// cobertura ZERO na CONAB pra esses três — ofertá-los faria o gráfico
// cair na série do Paraná e mostrar preço de outro estado. Melhor não
// oferecer do que oferecer algo que engana.
const PRODUTOS_GRAFICO = [
  { id: 'milho', label: 'Milho (27 estados)' },
  { id: 'cafe', label: 'Café (27 estados)' },
  { id: 'arroz', label: 'Arroz (27 estados)' },
  { id: 'feijao', label: 'Feijão (27 estados)' },
  { id: 'leite', label: 'Leite (27 estados)' },
  { id: 'banana', label: 'Banana (27 estados)' },
  { id: 'tomate', label: 'Tomate (27 estados)' },
  { id: 'mandioca_raiz', label: 'Mandioca — raiz (22 estados)' },
  { id: 'mandioca_farinha', label: 'Farinha de Mandioca (21 estados)' },
  { id: 'soja', label: 'Soja (17 estados)' },
  { id: 'boi_gordo', label: 'Boi Gordo (9 estados)' },
  { id: 'algodao', label: 'Algodão (9 estados)' },
  { id: 'trigo', label: 'Trigo (8 estados)' },

  // PRODUTOS DO LEVANTAMENTO POR ESTADO. A contagem entre parênteses é
  // o número de estados onde eu confirmei o produto no levantamento —
  // pode existir em outros que não apareceram na amostra, mas prefiro
  // informar a menor certa do que uma estimativa otimista.
  // Pecuária
  { id: 'frango', label: 'Frango' },
  { id: 'suinos', label: 'Suíno' },
  { id: 'ovos', label: 'Ovos de Galinha' },
  { id: 'leite_cabra', label: 'Leite de Cabra' },
  { id: 'mel', label: 'Mel de Abelha' },
  // Frutas
  { id: 'manga', label: 'Manga' },
  { id: 'maracuja', label: 'Maracujá' },
  { id: 'uva', label: 'Uva' },
  { id: 'laranja', label: 'Laranja' },
  { id: 'umbu', label: 'Umbu' },
  // Raízes e hortaliças
  { id: 'batata', label: 'Batata' },
  { id: 'batata_doce', label: 'Batata-doce' },
  { id: 'cebola', label: 'Cebola' },
  { id: 'alho', label: 'Alho' },
  { id: 'inhame', label: 'Inhame' },
  // Fibras e extrativismo
  { id: 'sisal', label: 'Sisal' },
  { id: 'piacava', label: 'Piaçava' },
  { id: 'borracha', label: 'Borracha Natural' },
  { id: 'caroco_algodao', label: 'Caroço de Algodão' },
  { id: 'mamona', label: 'Mamona em Baga' },
  // Valor agregado
  { id: 'cacau', label: 'Cacau Cultivado' },
  { id: 'pimenta_reino', label: 'Pimenta do Reino' },
  { id: 'castanha_caju', label: 'Castanha de Caju' },
  { id: 'guarana', label: 'Guaraná' },
  { id: 'amendoim', label: 'Amendoim' },
  { id: 'baru', label: 'Amêndoa de Baru' },
  { id: 'cana_de_acucar', label: 'Cana-de-açúcar' },
  { id: 'sorgo', label: 'Sorgo Granífero' },
];

const ESTADOS_GRAFICO = [
  'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo',
  'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba',
  'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul',
  'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
];

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
      <p className="text-[10px] text-theme-secondary mb-1">{dados.local} · {dados.granularidade === 'mes' ? 'por mês' : 'por dia'} · clima via {dados.fonteClima || 'Open-Meteo'}</p>
      {dados.fontePreco && <p className="text-[10px] text-theme-secondary mb-3">Preço via {dados.fontePreco}</p>}
      {dados.avisoIpea && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-2 mb-2 flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 dark:text-amber-200">{dados.avisoIpea}</p>
        </div>
      )}
      {dados.avisoPreco && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 dark:text-amber-300">{dados.avisoPreco}</p>
        </div>
      )}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 5, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
            interval={chartData.length > 20 ? Math.ceil(chartData.length / 15) - 1 : 0}
            angle={chartData.length > 8 ? -60 : 0}
            textAnchor={chartData.length > 8 ? 'end' : 'middle'}
            height={chartData.length > 8 ? 55 : 25}
          />
          <YAxis yAxisId="chuva" tick={{ fontSize: 10 }} label={{ value: 'mm de chuva', angle: -90, fontSize: 9, position: 'insideLeft' }} />
          <YAxis yAxisId="preco" orientation="right" tick={{ fontSize: 10 }} label={{ value: rotuloUnidade(dados.unidadePreco), angle: 90, fontSize: 9, position: 'insideRight' }} />
          <Tooltip contentStyle={{ fontSize: 11 }} formatter={(valor: any, nome: string) => [typeof valor === 'number' ? valor.toFixed(2) : valor, nome]} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar yAxisId="chuva" dataKey="chuvaMm" name="Chuva (mm)" fill="#60a5fa" radius={[3, 3, 0, 0]} maxBarSize={28}>
            <LabelList dataKey="chuvaMm" position="top" style={{ fontSize: 9, fill: 'var(--text-secondary)' }} formatter={(v: number) => {
              // Valores pequenos precisam de casa decimal: 0,5mm
              // arredondado vira "1", o que exagera a chuva em mais de
              // 100% — enganoso num gráfico que precisa passar confiança.
              if (v == null) return '';
              return v < 10 ? v.toFixed(1) : v.toFixed(0);
            }} />
          </Bar>
          <Bar yAxisId="preco" dataKey="preco" name={`Preço (${rotuloUnidade(dados.unidadePreco)})`} fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={28}>
            <LabelList dataKey="preco" position="top" style={{ fontSize: 9, fill: 'var(--text-secondary)' }} formatter={(v: number) => v ? v.toFixed(0) : ''} />
          </Bar>
          <Line yAxisId="chuva" type="monotone" dataKey="chuvaTendencia" name="Tendência clima" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 2" />
          <Line yAxisId="preco" type="monotone" dataKey="precoTendencia" name="Tendência preço" stroke="#047857" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function GraficoPrecoClima({ produto, produtoLabel, estado, cidade }: Props) {
  const anoAtual = new Date().getFullYear();
  const hoje = new Date();
  const daqui16Dias = new Date(hoje.getTime() + 16 * 86400000);
  const dataFimMax = daqui16Dias.toISOString().slice(0, 10);

  // Tela de configuração — o usuário escolhe explicitamente produto,
  // estado e período antes de ver qualquer gráfico, em vez de herdar
  // silenciosamente o que estava selecionado lá em cima em Cotações
  // (causa real de confusão: a pessoa às vezes nem sabia o que o
  // gráfico estava mostrando).
  const [configConfirmada, setConfigConfirmada] = useState(false);
  const [produtoEscolhido, setProdutoEscolhido] = useState(produto || 'boi_gordo');
  const [estadoEscolhido, setEstadoEscolhido] = useState(estado || '');
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  const inicioAnoPassado = dataInicio.replace(/^\d{4}/, String(new Date(dataInicio).getFullYear() - 1));
  const fimAnoPassado = dataFim.replace(/^\d{4}/, String(new Date(dataFim).getFullYear() - 1));

  const atual = useChartData(produtoEscolhido, estadoEscolhido, cidade, dataInicio, dataFim);
  const anoPassado = useChartData(produtoEscolhido, estadoEscolhido, cidade, inicioAnoPassado, fimAnoPassado);

  const produtoLabelEscolhido = PRODUTOS_GRAFICO.find(p => p.id === produtoEscolhido)?.label || produtoLabel;

  if (!configConfirmada) {
    return (
      <div className="bg-theme-card rounded-2xl border border-theme p-4 space-y-3 shadow-theme">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-theme-secondary" />
          <h3 className="text-sm font-bold text-theme-primary">Configurar Gráfico Preço × Clima</h3>
        </div>
        <p className="text-[11px] text-theme-secondary">Escolha o produto, o estado e o período — o gráfico compara o preço com a chuva da região, e mostra o mesmo período do ano passado ao lado.</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Produto</label>
            <select value={produtoEscolhido} onChange={e => setProdutoEscolhido(e.target.value)} className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary">
              {PRODUTOS_GRAFICO.map(p => <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Estado</label>
            <select value={estadoEscolhido} onChange={e => setEstadoEscolhido(e.target.value)} className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary">
              <option value="" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>Selecione um estado</option>
              {ESTADOS_GRAFICO.map(uf => <option key={uf} value={uf} style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>{uf}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">De</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">Até</label>
            <input type="date" value={dataFim} max={dataFimMax} onChange={e => setDataFim(e.target.value)} className="w-full text-xs border border-theme rounded-lg px-2 py-1.5 bg-theme-card text-theme-primary" />
          </div>
        </div>
        <p className="text-[10px] text-theme-secondary">Previsão de clima disponível até {new Date(dataFimMax).toLocaleDateString('pt-BR')} (limite do Open-Meteo). Selecione só um mês pra ver o detalhe por dia.</p>

        <button
          onClick={() => { if (estadoEscolhido) setConfigConfirmada(true); else alert('Escolha um estado pra gerar o gráfico.'); }}
          className="btn-primary w-full text-sm"
        >
          Gerar Gráfico
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setConfigConfirmada(false)} className="text-xs font-bold text-[var(--primary)] flex items-center gap-1">
        <Settings2 size={12} /> Alterar configuração ({produtoLabelEscolhido} — {estadoEscolhido})
      </button>

      {atual.loading && <p className="text-xs text-theme-secondary text-center py-6">Montando o gráfico...</p>}
      {atual.error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">{atual.error}</p>}
      <GraficoIndividual titulo={`${produtoLabelEscolhido} × Clima — período selecionado`} dados={atual.dados} />

      {anoPassado.error && <p className="text-xs text-theme-secondary">Não foi possível comparar com o ano passado agora.</p>}
      <GraficoIndividual titulo={`${produtoLabelEscolhido} × Clima — mesmo período, ano anterior`} dados={anoPassado.dados} />

      <HistoricoPrecoPessoal dataInicio={dataInicio} dataFim={dataFim} />
    </div>
  );
}
