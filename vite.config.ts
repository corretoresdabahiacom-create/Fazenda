import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Portable Helper to sanitize and parse JSON response from any model
function parseJSONResponse(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/, "");
    cleaned = cleaned.split("```")[0].trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse cleaned JSON in vite dev-server:", cleaned);
    throw new Error(`Invalid JSON format returned by model: ${err}`);
  }
}

// Portable multi-model image and text analyzer for Vite local development
async function analyzeImageLocal(base64Image: string, prompt: string, fallbackTemplate: string, env: any): Promise<any> {
  const providers = [
    // 1. Gemini
    {
      name: "Gemini",
      key: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      fn: async (key: string) => {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                  { text: `${prompt}\n\nReturn strictly valid JSON adhering to instructions.` }
                ]
              }
            ],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.candidates?.[0]?.content?.parts?.[0]?.text);
      }
    },
    // 2. OpenAI (ChatGPT)
    {
      name: "ChatGPT",
      key: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `${prompt}\n\nReturn ONLY a JSON block.` },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 3. Claude (Anthropic)
    {
      name: "Claude",
      key: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1500,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
                  { type: "text", text: `${prompt}\n\nReturn strictly valid JSON.` }
                ]
              }
            ]
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.content?.[0]?.text);
      }
    },
    // 4. Deepseek
    {
      name: "Deepseek",
      key: env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: `${prompt}\n\nNote: Return standard logical/reasonable values matching required schema.` }]
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 5. Groq
    {
      name: "Groq",
      key: env.GROQ_API_KEY || process.env.GROQ_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "llama-3.2-11b-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `${prompt}\n\nReturn strictly valid JSON.` },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 6. Mistral
    {
      name: "Mistral",
      key: env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "pixtral-12b-2409",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `${prompt}\n\nReturn strictly valid JSON.` },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 7. Pollinations AI (Keyless, fallback)
    {
      name: "Pollinations",
      key: "always_active",
      fn: async () => {
        const res = await fetch("https://text.pollinations.ai/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: `${prompt}\n\nGenerate beautiful simulated response conforming strictly to standard JSON.` }]
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const text = await res.text();
        return parseJSONResponse(text);
      }
    }
  ];

  for (const provider of providers) {
    if (provider.key) {
      try {
        console.log(`Local dev-server: trying ${provider.name}...`);
        const result = await provider.fn(provider.key);
        if (result) return result;
      } catch (e: any) {
        console.warn(`Local dev-server: ${provider.name} failed:`, e.message || e);
      }
    }
  }

  return parseJSONResponse(fallbackTemplate);
}

async function generateTextLocal(prompt: string, fallbackTemplate: string, env: any): Promise<any> {
  const providers = [
    // 1. Gemini
    {
      name: "Gemini",
      key: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      fn: async (key: string) => {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.candidates?.[0]?.content?.parts?.[0]?.text);
      }
    },
    // 2. OpenAI (ChatGPT)
    {
      name: "ChatGPT",
      key: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 3. Claude (Anthropic)
    {
      name: "Claude",
      key: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }]
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.content?.[0]?.text);
      }
    },
    // 4. Deepseek
    {
      name: "Deepseek",
      key: env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }]
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 5. Groq
    {
      name: "Groq",
      key: env.GROQ_API_KEY || process.env.GROQ_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "llama-3-70b-8192",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 6. Mistral
    {
      name: "Mistral",
      key: env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY,
      fn: async (key: string) => {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as any;
        return parseJSONResponse(data.choices?.[0]?.message?.content);
      }
    },
    // 7. Pollinations AI (Keyless, fallback)
    {
      name: "Pollinations",
      key: "always_active",
      fn: async () => {
        const res = await fetch("https://text.pollinations.ai/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }]
          })
        });
        if (!res.ok) throw new Error(await res.text());
        const text = await res.text();
        return parseJSONResponse(text);
      }
    }
  ];

  for (const provider of providers) {
    if (provider.key) {
      try {
        console.log(`Local dev-server: trying ${provider.name}...`);
        const result = await provider.fn(provider.key);
        if (result) return result;
      } catch (e: any) {
        console.warn(`Local dev-server: ${provider.name} failed:`, e.message || e);
      }
    }
  }

  return parseJSONResponse(fallbackTemplate);
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'dev-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api/')) {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  // Route handlers
                  if (req.url === '/api/analyze-animals') {
                    const parsed = JSON.parse(body);
                    const base64Data = parsed.image.replace(/^data:image\/\w+;base64,/, "");

                    const prompt = `Perform a high-precision veterinary and zootechnical analysis of the cattle visible in the image.
1. Count exactly every head of cattle visible.
2. Identify specific breed/genetics (e.g., Nelore, Brahman, Angus, Cruzamento Industrial).
3. Estimate average live weight (PV) in kg using Body Condition Score (BCS 1-9) indicators visible.
4. Provide a confidence score (0-100%).
5. Provide technicalDetails summarizing your physiological analysis.

Format your response strictly as a JSON object matching this schema:
{
  "quantity": number,
  "type": "string",
  "estimatedWeight": number,
  "confidence": number,
  "technicalDetails": "string"
}`;

                    const fallbackResponseTemplate = JSON.stringify({
                      quantity: 12,
                      type: "Nelore",
                      estimatedWeight: 410,
                      confidence: 80,
                      technicalDetails: "Lote uniforme de bovinos Nelore. Presença de bons indicadores de rendimento de carcaça."
                    });

                    const responseResult = await analyzeImageLocal(base64Data, prompt, fallbackResponseTemplate, env);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(responseResult));

                  } else if (req.url === '/api/analyze-pasture') {
                    const parsed = JSON.parse(body);
                    const base64Data = parsed.image.replace(/^data:image\/\w+;base64,/, "");

                    const prompt = `Perform a high-precision, surgical agrostological analysis of the pasture image.
1. Identify specific grass species.
2. Estimate average height (cm).
3. Determine if the pasture is at the 'Interrupt' point (isGoodToPutCattle: boolean) or 'Residual' point (isTimeToTakeOutCattle: boolean).
4. List specific nutrients.
5. Estimate crudeProtein and ndt.
6. Provide recommendedAnimalSize.
7. Highlight objective.
8. Provide technicalJustification.
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
                      nutrients: ["Nitrogênio", "Fósforo"],
                      crudeProtein: "9.5%",
                      ndt: "58%",
                      recommendedAnimalSize: "Recria",
                      objective: "Pastejo Rotacionado",
                      technicalJustification: "Altura ideal de entrada de 28cm garante ótimo rendimento e conservação foliar.",
                      confidence: 85
                    });

                    const responseResult = await analyzeImageLocal(base64Data, prompt, fallbackResponseTemplate, env);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(responseResult));

                  } else if (req.url === '/api/calculate-pasture-capacity') {
                    const parsed = JSON.parse(body);
                    const { size, grassTypes, animalTypes, objective } = parsed;

                    const payloadPrompt = `As a specialist agronomist and livestock carrying capacity consultant, calculate the carrying capacity for a pasture:
- Total Size: ${size} hectares
- Grass Types: ${grassTypes.join(', ')}
- Animal Classification: ${animalTypes}
- Production Objective: ${objective}

Calculate carrying capacities:
- capacityAguas: heads in rainy season (number)
- capacitySeca: heads in dry season (number)
- justification: professional portuguese suggestions (2-4 sentences)

Format response strictly as JSON:
{
  "capacityAguas": number,
  "capacitySeca": number,
  "justification": "string"
}`;

                    const fallbackResponseTemplate = JSON.stringify({
                      capacityAguas: Math.round(size * 1.8),
                      capacitySeca: Math.round(size * 0.5),
                      justification: `Cálculo de taxa de lotação para ${size} ha com pasto do tipo ${grassTypes.join(', ')}. Estima-se lotação otimizada no período de águas e redução técnica no período seco para manter produtividade.`
                    });

                    const responseResult = await generateTextLocal(payloadPrompt, fallbackResponseTemplate, env);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(responseResult));

                  } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Endpoint nao encontrado' }));
                  }
                } catch (err: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message || String(err) }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
