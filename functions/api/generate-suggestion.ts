import { generateText } from "./aiClient";

interface Env {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GROQ_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  POLLINATIONS_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { inventory, tasks } = await request.json() as { inventory?: any[]; tasks?: any[] };

    const prompt = `Você é um agrônomo especialista em pecuária de corte, veterinária e gestão de fazendas de alta produtividade (zootecnia de precisão).
Analise os dados de estoque e tarefas da fazenda abaixo e ofereça um conselho técnico diário específico, acionável e prático.

ESTOQUE ATUAL:
${JSON.stringify(inventory || [], null, 2)}

TAREFAS E COMPROMISSOS ATUAIS:
${JSON.stringify(tasks || [], null, 2)}

DIRETRIZES DE ANÁLISE:
1. Veja se há algum insumo essencial (como sal mineral, vacinas, vermífugos, suplementos protéicos ou ração) com estoque muito baixo (ex: quantidade < 15 ou menor que o esperado para uso).
2. Se houver, gere um alerta sobre esse estoque, recomendando a compra ou reabastecimento.
3. Se o estoque estiver todo regular, analise as tarefas pendentes de alta prioridade ou atrasadas, gerando um conselho de como otimizar o tempo, delegar, ou resolver o gargalo.
4. Se ambos estiverem em excelente estado, sugira um conselho produtivo geral de manejo rotacionado de pastos, manejo sanitário, ou pesagem periódica.
5. Retorne a resposta estritamente no formato JSON abaixo, em português.

FORMATO DO RETORNO JSON:
{
  "title": "Título curto e chamativo para o conselho diário",
  "advice": "O conselho técnico detalhado e acionável em português (máximo de 3 parágrafos contendo fatos reais da fazenda informada)",
  "priority": "High" | "Medium" | "Low",
  "category": "Estoque" | "Tarefas" | "Pastagem" | "Manejo Zootécnico"
}`;

    const fallbackResponseTemplate = JSON.stringify({
      title: "Planejamento Preventivo de Insumos",
      advice: "Com base na análise geral, recomenda-se inspecionar o estoque de sal mineral e suplementos proteico-energéticos para garantir que a transição de estação não afete o ganho de peso diário dos animais. O manejo nutricional estratégico evita quedas súbitas na produtividade no pasto.",
      priority: "Medium",
      category: "Estoque"
    });

    const parsedResult = await generateText(prompt, fallbackResponseTemplate, env);

    return new Response(JSON.stringify(parsedResult), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Suggestion Generator Error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate suggestion: " + (error.message || String(error)) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
