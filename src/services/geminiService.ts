const CONFIG_KEY = 'gemini-api-config';

export interface GeminiConfig {
  apiKey: string;
}

export function getGeminiConfig(): GeminiConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as GeminiConfig;
}

export function setGeminiConfig(config: GeminiConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

const MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/** Generate text from Gemini API */
export async function geminiGenerate(
  config: GeminiConfig,
  prompt: string,
  temperature = 0.3,
): Promise<string> {
  const url = `${BASE_URL}/${MODEL}:generateContent?key=${config.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message;
    throw new Error(msg ?? `Gemini API error: ${res.status}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text.trim();
}

/** Generate and parse JSON response from Gemini */
export async function geminiGenerateJSON<T>(
  config: GeminiConfig,
  prompt: string,
): Promise<T> {
  const text = await geminiGenerate(config, prompt, 0.1);

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/[[{][\s\S]*[}\]]/);
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text;

  return JSON.parse(jsonStr.trim()) as T;
}
