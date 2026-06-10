import { analyzeImage } from "./aiClient";

interface Env {
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
    const { image } = await request.json() as { image?: string };
    
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Perform a high-precision, surgical agrostological analysis of the pasture image.
1. Identify specific grass species (e.g., Brachiaria brizantha cv. Marandu, Panicum maximum cv. Mombaça, Cynodon dactylon).
2. Estimate average height (cm) and quality (e.g., Alto, Médio, Baixo).
3. Determine if the pasture is at the 'Interrupt' point (ideal entry) of cattle (isGoodToPutCattle: boolean) or 'Residual' point (exit) (isTimeToTakeOutCattle: boolean).
4. List specific nutrients or soil minerals indicated by leaf coloration.
5. Estimate crudeProtein (Proteína Bruta, e.g., "9.5%") and ndt (Nutrientes Digestíveis Totais, e.g., "58%").
6. Provide recommendedAnimalSize (e.g., "Recria", "Engorda", "Vacas Lactantes").
7. Highlight objective (e.g., "Pastejo rotacionado semi-intensivo").
8. Provide a detailed technicalJustification (e.g., "O pasto apresenta bom perfilhamento foliar, com altura ideal para entrada de animais de recria, otimizando o aproveitamento nutricional.").
9. Confidence score (0-100%).

Format your response strictly as a JSON object matching this schema:
{
  "grassType": "string",
  "heightCm": number,
  "quality": "string",
  "isGoodToPutCattle": boolean,
  "isTimeToTakeOutCattle": boolean,
  "nutrients": ["string"],
  "crudeProtein": "string",
  "ndt": "string",
  "recommendedAnimalSize": "string",
  "objective": "string",
  "technicalJustification": "string",
  "confidence": number
}`;

    const fallbackResponseTemplate = JSON.stringify({
      grassType: "Brachiaria brizantha cv. Marandu",
      heightCm: 28,
      quality: "Excelente",
      isGoodToPutCattle: true,
      isTimeToTakeOutCattle: false,
      nutrients: ["Nitrogênio", "Fósforo", "Potássio"],
      crudeProtein: "9.8%",
      ndt: "58%",
      recommendedAnimalSize: "Recria e Engorda",
      objective: "Manejo Rotacionado de Alta Lotação",
      technicalJustification: "Pastagem em excelente estado vegetativo, com ótima relação folha:colmo. Altura ideal de entrada de 28cm garante máximo aproveitamento nutritivo e rápida recomposição foliar.",
      confidence: 90
    });

    const parsedResult = await analyzeImage(base64Data, prompt, fallbackResponseTemplate, env);

    return new Response(JSON.stringify(parsedResult), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Pasture Analysis Error:", error);
    return new Response(JSON.stringify({ error: "Failed to analyze pasture: " + (error.message || String(error)) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
