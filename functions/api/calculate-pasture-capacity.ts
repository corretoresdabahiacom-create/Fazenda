import { requireUser } from './_googleAuth';
import { generateText } from "./aiClient";

interface Env {
  FIREBASE_PROJECT_ID?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GROQ_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  POLLINATIONS_API_KEY?: string;
  HUGGINGFACE_API_KEY?: string;
  KREA_API_KEY?: string;
  SEGMIND_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    // Só usuários logados (ou só admin) — sem isso, qualquer pessoa na
    // internet podia chamar este endpoint e gastar a cota paga das APIs.
    const auth = await requireUser(request, env);
    if (auth instanceof Response) return auth;
    const { size, grassTypes, animalTypes, objective } = await request.json() as { 
      size?: number; 
      grassTypes?: string[]; 
      animalTypes?: string; 
      objective?: string; 
    };

    if (!size || !Array.isArray(grassTypes) || grassTypes.length === 0 || !animalTypes || !objective
      || typeof size !== 'number' || !Number.isFinite(size) || size <= 0 || size > 100000) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const payloadPrompt = `As a specialist agronomist and livestock carrying capacity consultant, calculate the carrying capacity (lotação em cabeças) for a pasture with the following characteristics:
- Total Size: ${size} hectares
- Grass Types: ${grassTypes.join(', ')}
- Animal Classification: ${animalTypes}
- Rancher's Breeding/Production Objective: ${objective}

Standard Brazilian Livestock Rules to apply:
1. One standard Animal Unit (UA) = 450 kg liveweight (cabeça com 450kg).
2. Rainy season ("Águas") typically supports high stocking rates. Depending on grass (e.g. Brachiaria is around 1.2 to 2.5 UA/ha; Mombaça/Panicum can be 2.0 to 4.5 UA/ha). Convert this to head counts based on the average size of the specified animal category (e.g., calves are around 0.4-0.6 UA, steers are 0.7-1.0 UA, cows are 1.0 UA).
3. Dry season ("Seca") capacity drops significantly. Typically, unsupplemented fields drop to 0.3 - 0.8 UA/ha.
4. Adjust stocking rate suggestions so they comply with the rancher's objective: e.g. "Engorda Rápida" (Quick fattening) requires slightly lower, high-quality grazing pressure to maximize weight gain, whereas "Recria em pastejo rotacionado" can support higher, controlled rotational pressures.

Calculate two integer numbers representing:
- capacityAguas: optimal maximum head count during the rainy season.
- capacitySeca: optimal carrying capacity in head count during the dry season without complete pasture degradation.
- justification: a brief professional explanation of the calculation and suggest management guidance (such as rotational cycles, supplement recommendation for dry season) in Portuguese (2-4 sentences).

Format your response strictly as a JSON object matching this schema:
{
  "capacityAguas": number,
  "capacitySeca": number,
  "justification": "string"
}`;

    const fallbackResponseTemplate = JSON.stringify({
      capacityAguas: Math.round(size * 2),
      capacitySeca: Math.round(size * 0.6),
      justification: `Cálculo estimado para ${size} ha com pasto do tipo ${grassTypes.join(', ')}. No período das águas recomenda-se taxa de lotação semi-intensiva para atingir o objetivo de ${objective}. Na seca, recomenda-se suplementação proteico-energética para manter o ganho de peso sem degradar a pastagem.`
    });

    const parsedResult = await generateText(payloadPrompt, fallbackResponseTemplate, env);

    // Checagem de sanidade da resposta da IA. Todo o resto do app tem
    // faixas de plausibilidade; aqui o número ia direto para a tela.
    // Limites generosos: até 12 cab/ha nas águas (bezerros em capim de
    // alta produção, rotacionado) e até 5 cab/ha na seca, e a seca nunca
    // acima das águas. Fora disso, usa o cálculo conservador de reserva.
    const fallback = JSON.parse(fallbackResponseTemplate);
    const aguas = Math.round(Number((parsedResult as any)?.capacityAguas));
    const seca = Math.round(Number((parsedResult as any)?.capacitySeca));
    const plausivel = Number.isFinite(aguas) && Number.isFinite(seca)
      && aguas >= 0 && seca >= 0
      && aguas <= size * 12 && seca <= size * 5 && seca <= aguas;
    const resultado = plausivel
      ? { ...(parsedResult as any), capacityAguas: aguas, capacitySeca: seca }
      : { ...fallback, justification: `${fallback.justification} (A estimativa automática veio fora da faixa plausível e foi substituída por este cálculo conservador.)` };

    return new Response(JSON.stringify(resultado), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("AI Pasture Capacity Calculation Error:", error);
    return new Response(JSON.stringify({ error: "Failed to calculate pasture capacity via AI: " + (error.message || String(error)) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
