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

// Consultor Rural IA — o produtor pergunta em português normal (ex: "posso
// plantar milho semana que vem?", "qual lote está mais lucrativo?") e a IA
// responde cruzando os dados reais já cadastrados no sistema: clima,
// talhões, financeiro, rebanho. Sempre deixa claro quando a resposta é uma
// sugestão geral (falta dado suficiente) versus baseada em dado real da
// fazenda.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { question, context: farmContext } = (await request.json()) as {
      question?: string;
      context?: Record<string, unknown>;
    };

    if (!question || !question.trim()) {
      return new Response(JSON.stringify({ error: "Pergunta vazia." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um consultor rural experiente — engenheiro agrônomo e zootecnista — respondendo diretamente ao produtor de uma fazenda real, em português brasileiro, de forma direta e prática (sem enrolação, sem jargão desnecessário).

PERGUNTA DO PRODUTOR:
"${question}"

DADOS REAIS DA FAZENDA (use estes dados sempre que forem relevantes para a pergunta; se um dado necessário não estiver aqui, diga isso claramente em vez de inventar):
${JSON.stringify(farmContext || {}, null, 2)}

DIRETRIZES:
1. Responda diretamente à pergunta primeiro, depois explique o raciocínio.
2. Se os dados da fazenda acima tiverem informação relevante (clima, talhões, financeiro, animais), cite ela explicitamente na resposta.
3. Se a pergunta pedir algo que os dados não cobrem (ex: preço de mercado, previsão de longo prazo), deixe claro que é uma orientação geral, não baseada em dado específico da fazenda.
4. Nunca invente números que não estão nos dados fornecidos.
5. Seja conciso: no máximo 3 parágrafos curtos.
6. Retorne a resposta estritamente no formato JSON abaixo.

FORMATO DO RETORNO JSON:
{
  "answer": "resposta direta e completa em português",
  "basedOnRealData": true ou false (true se a resposta usou dados reais da fazenda fornecidos acima; false se foi só orientação geral)
}`;

    const fallbackResponseTemplate = JSON.stringify({
      answer:
        "Não consegui processar sua pergunta agora — tente novamente em alguns instantes, ou reformule de forma mais específica.",
      basedOnRealData: false,
    });

    const parsedResult = await generateText(prompt, fallbackResponseTemplate, env);

    return new Response(JSON.stringify(parsedResult), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Consultor Rural IA Error:", error);
    return new Response(
      JSON.stringify({ error: "Falha ao consultar a IA: " + (error.message || String(error)) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};