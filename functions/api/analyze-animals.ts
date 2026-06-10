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

    const prompt = `Perform a high-precision veterinary and zootechnical analysis of the cattle visible in the image.
1. Count exactly every head of cattle visible.
2. Identify specific breed/genetics (e.g., Nelore, Brahman, Angus, Cruzamento Industrial).
3. Estimate average live weight (PV) in kg using Body Condition Score (BCS 1-9) indicators visible (ribs, hips, muscle definition).
4. Provide a confidence score (0-100%).
5. Provide technicalDetails summarizing your physiological analysis (e.g., "Animais com boa musculatura, Nelore comercial").

Format your response strictly as a JSON object matching this schema:
{
  "quantity": number,
  "type": "string",
  "estimatedWeight": number,
  "confidence": number,
  "technicalDetails": "string"
}`;

    const fallbackResponseTemplate = JSON.stringify({
      quantity: 15,
      type: "Nelore Comercial",
      estimatedWeight: 420,
      confidence: 85,
      technicalDetails: "Lote uniforme de machos Nelore em regime de engorda no pasto. Boa conformação de carcaça e escore corporal estimado em 6."
    });

    const parsedResult = await analyzeImage(base64Data, prompt, fallbackResponseTemplate, env);

    return new Response(JSON.stringify(parsedResult), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Animal Analysis Error:", error);
    return new Response(JSON.stringify({ error: "Failed to analyze animals: " + (error.message || String(error)) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
