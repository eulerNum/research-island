// ─── Unified LLM Service ──────────────────────────────────
// Routes AI calls to Gemini / OpenAI / Anthropic based on user config.

// ─── Types ────────────────────────────────────────────────

export type LLMProvider = 'gemini' | 'openai' | 'anthropic';
export type AIFeature = 'chat' | 'deepSearch' | 'summary';
export type CostTier = 'free' | 'cheap' | 'moderate' | 'expensive';

export interface ModelOption {
  provider: LLMProvider;
  modelId: string;
  displayName: string;
  costTier: CostTier;
}

export interface LLMConfig {
  apiKeys: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
  };
  models: {
    chat: { provider: LLMProvider; modelId: string };
    deepSearch: { provider: LLMProvider; modelId: string };
    summary: { provider: LLMProvider; modelId: string };
  };
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface LLMToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LLMToolResponse {
  textParts: string[];
  toolCalls: LLMToolCall[];
  rawContent: unknown;
}

export interface ToolResult {
  callId?: string;
  name: string;
  content: string;
}

// ─── Available Models ─────────────────────────────────────

export const AVAILABLE_MODELS: ModelOption[] = [
  { provider: 'gemini', modelId: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', costTier: 'free' },
  { provider: 'gemini', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', costTier: 'cheap' },
  { provider: 'gemini', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', costTier: 'moderate' },
  { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', costTier: 'cheap' },
  { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o', costTier: 'moderate' },
  { provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', costTier: 'cheap' },
  { provider: 'anthropic', modelId: 'claude-sonnet-4-6-20250514', displayName: 'Claude Sonnet 4.6', costTier: 'expensive' },
];

const DEFAULT_MODELS: LLMConfig['models'] = {
  chat: { provider: 'gemini', modelId: 'gemini-2.5-flash' },
  deepSearch: { provider: 'gemini', modelId: 'gemini-2.5-flash-lite' },
  summary: { provider: 'gemini', modelId: 'gemini-2.5-flash' },
};

// ─── Config Management ────────────────────────────────────

const CONFIG_KEY = 'ai-model-config';

export function getLLMConfig(): LLMConfig {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as LLMConfig;
    } catch { /* fall through to migration */ }
  }

  // Migrate from legacy keys
  return migrateLegacyConfig();
}

export function setLLMConfig(config: LLMConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function migrateLegacyConfig(): LLMConfig {
  const config: LLMConfig = {
    apiKeys: {},
    models: { ...DEFAULT_MODELS },
  };

  // Migrate gemini key
  const geminiRaw = localStorage.getItem('gemini-api-config');
  if (geminiRaw) {
    try {
      const g = JSON.parse(geminiRaw) as { apiKey: string };
      if (g.apiKey) config.apiKeys.gemini = g.apiKey;
    } catch { /* ignore */ }
    localStorage.removeItem('gemini-api-config');
  }

  // Migrate claude key
  const claudeRaw = localStorage.getItem('claude-api-config');
  if (claudeRaw) {
    try {
      const c = JSON.parse(claudeRaw) as { apiKey: string };
      if (c.apiKey) config.apiKeys.anthropic = c.apiKey;
    } catch { /* ignore */ }
    localStorage.removeItem('claude-api-config');
  }

  // If anthropic key exists, default summary to Claude Haiku (previous behavior)
  if (config.apiKeys.anthropic) {
    config.models.summary = { provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001' };
  }

  setLLMConfig(config);
  return config;
}

/** Get API key for a feature's selected provider */
function getApiKey(config: LLMConfig, feature: AIFeature): string {
  const { provider } = config.models[feature];
  const key = config.apiKeys[provider];
  if (!key) {
    const names: Record<LLMProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Anthropic' };
    throw new Error(`${names[provider]} API 키가 설정되지 않았습니다. AI 설정에서 키를 입력해주세요.`);
  }
  return key;
}

// ─── Public API ───────────────────────────────────────────

export async function llmGenerate(
  feature: AIFeature,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const config = getLLMConfig();
  const apiKey = getApiKey(config, feature);
  const { provider, modelId } = config.models[feature];

  switch (provider) {
    case 'gemini': return callGeminiText(apiKey, modelId, messages, options);
    case 'openai': return callOpenAIText(apiKey, modelId, messages, options);
    case 'anthropic': return callAnthropicText(apiKey, modelId, messages, options);
  }
}

export async function llmGenerateJSON<T>(
  feature: AIFeature,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<T> {
  const config = getLLMConfig();
  const { provider } = config.models[feature];

  if (provider === 'openai') {
    // OpenAI supports native JSON mode
    const apiKey = getApiKey(config, feature);
    const { modelId } = config.models[feature];
    const text = await callOpenAIText(apiKey, modelId, messages, { temperature: 0.1, jsonMode: true });
    return JSON.parse(text.trim()) as T;
  }

  // Gemini & Anthropic: prompt-based JSON extraction
  const text = await llmGenerate(feature, messages, { temperature: 0.1 });
  return extractJSON<T>(text);
}

export async function llmChatWithTools(
  feature: AIFeature,
  messages: unknown[],
  systemPrompt: string,
  tools: ToolDeclaration[],
): Promise<LLMToolResponse> {
  const config = getLLMConfig();
  const apiKey = getApiKey(config, feature);
  const { provider, modelId } = config.models[feature];

  switch (provider) {
    case 'gemini': return callGeminiWithTools(apiKey, modelId, messages, systemPrompt, tools);
    case 'openai': return callOpenAIWithTools(apiKey, modelId, messages, systemPrompt, tools);
    case 'anthropic': return callAnthropicWithTools(apiKey, modelId, messages, systemPrompt, tools);
  }
}

/** Build a tool result message in the provider's native format */
export function buildToolResultMessage(
  feature: AIFeature,
  results: ToolResult[],
): { role: string; content?: unknown; parts?: unknown[] } {
  const config = getLLMConfig();
  const { provider } = config.models[feature];

  switch (provider) {
    case 'gemini':
      return {
        role: 'user',
        parts: results.map((r) => ({
          functionResponse: { name: r.name, response: { result: r.content } },
        })),
      };

    case 'openai':
      // OpenAI expects individual tool_result messages — caller should handle array
      // For simplicity, return first result; multi-result handled at call site
      return {
        role: 'tool',
        content: results.map((r) => ({
          role: 'tool' as const,
          tool_call_id: r.callId ?? r.name,
          content: r.content,
        })),
      };

    case 'anthropic':
      return {
        role: 'user',
        content: results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.callId ?? r.name,
          content: r.content,
        })),
      };
  }
}

/** Get current provider for a feature (used by chat service for conversation formatting) */
export function getFeatureProvider(feature: AIFeature): LLMProvider {
  return getLLMConfig().models[feature].provider;
}

// ─── JSON Extraction Helper ──────────────────────────────

function extractJSON<T>(text: string): T {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/[[{][\s\S]*[}\]]/);
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text;
  return JSON.parse(jsonStr.trim()) as T;
}

// ─── Gemini Provider ─────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiAPIResponse {
  candidates?: {
    content?: { parts?: GeminiAPIPart[]; role?: string };
    finishReason?: string;
  }[];
}

interface GeminiAPIPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

async function callGeminiText(
  apiKey: string,
  modelId: string,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const systemParts = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const contents = nonSystem.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: options?.temperature ?? 0.3 },
  };

  if (systemParts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemParts.map((s) => s.content).join('\n') }] };
  }

  const url = `${GEMINI_BASE}/${modelId}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini API error: ${res.status}`);
  }

  const data = (await res.json()) as GeminiAPIResponse;
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

async function callGeminiWithTools(
  apiKey: string,
  modelId: string,
  messages: unknown[],
  systemPrompt: string,
  tools: ToolDeclaration[],
): Promise<LLMToolResponse> {
  const url = `${GEMINI_BASE}/${modelId}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages,
      tools: [{ functionDeclarations: tools }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini API error: ${res.status}`);
  }

  const data = (await res.json()) as GeminiAPIResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  const textParts: string[] = [];
  const toolCalls: LLMToolCall[] = [];

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args ?? {},
      });
    }
  }

  // rawContent: Gemini-native parts for multi-turn conversation
  const rawContent = {
    role: 'model',
    parts: parts.map((p) => {
      if (p.functionCall) return { functionCall: p.functionCall };
      if (p.text) return { text: p.text };
      return { text: '' };
    }),
  };

  return { textParts, toolCalls, rawContent };
}

// ─── OpenAI Provider ─────────────────────────────────────

async function callOpenAIText(
  apiKey: string,
  modelId: string,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<string> {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options?.temperature ?? 0.3,
  };
  if (options?.maxTokens) body.max_tokens = options.maxTokens;
  if (options?.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

async function callOpenAIWithTools(
  apiKey: string,
  modelId: string,
  messages: unknown[],
  systemPrompt: string,
  tools: ToolDeclaration[],
): Promise<LLMToolResponse> {
  // Convert messages from Gemini-native format to OpenAI format
  const oaiMessages = convertToOpenAIMessages(messages, systemPrompt);

  const oaiTools = tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: oaiMessages,
      tools: oaiTools,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;

  const textParts: string[] = choice?.content ? [choice.content] : [];
  const toolCalls: LLMToolCall[] = (choice?.tool_calls as OpenAIToolCall[] | undefined)?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments),
  })) ?? [];

  // rawContent: OpenAI-native assistant message for multi-turn
  const rawContent = {
    role: 'assistant',
    content: choice?.content ?? null,
    tool_calls: choice?.tool_calls ?? undefined,
  };

  return { textParts, toolCalls, rawContent };
}

function convertToOpenAIMessages(
  geminiMessages: unknown[],
  systemPrompt: string,
): { role: string; content?: string | unknown[]; tool_calls?: unknown[]; tool_call_id?: string }[] {
  const result: { role: string; content?: string | unknown[]; tool_calls?: unknown[]; tool_call_id?: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of geminiMessages) {
    const m = msg as { role: string; content?: unknown; parts?: unknown[]; tool_calls?: unknown[]; tool_call_id?: string };

    // Already in OpenAI format (from rawContent)
    if (m.role === 'assistant' && m.tool_calls) {
      result.push(m as { role: string; content?: string; tool_calls?: unknown[] });
      continue;
    }
    if (m.role === 'tool') {
      // Multi-tool results come as array in content
      const content = m.content as { role: string; tool_call_id: string; content: string }[] | undefined;
      if (Array.isArray(content)) {
        for (const tr of content) {
          result.push({ role: 'tool', content: tr.content, tool_call_id: tr.tool_call_id });
        }
      }
      continue;
    }

    // Gemini-native format: convert
    if (m.parts && Array.isArray(m.parts)) {
      const parts = m.parts as GeminiAPIPart[];

      // Check if it's a model response with function calls
      if (m.role === 'model') {
        const text = parts.filter((p) => p.text).map((p) => p.text).join('');
        const fcs = parts.filter((p) => p.functionCall);

        if (fcs.length > 0) {
          result.push({
            role: 'assistant',
            content: text || undefined,
            tool_calls: fcs.map((fc, i) => ({
              id: `call_${i}`,
              type: 'function',
              function: {
                name: fc.functionCall!.name,
                arguments: JSON.stringify(fc.functionCall!.args ?? {}),
              },
            })),
          });
        } else {
          result.push({ role: 'assistant', content: text });
        }
        continue;
      }

      // Check if it's function responses (user role in Gemini)
      const funcResponses = parts.filter((p) => p.functionResponse);
      if (funcResponses.length > 0) {
        for (const fr of funcResponses) {
          result.push({
            role: 'tool',
            content: typeof fr.functionResponse!.response === 'string'
              ? fr.functionResponse!.response
              : JSON.stringify(fr.functionResponse!.response),
            tool_call_id: fr.functionResponse!.name,
          });
        }
        continue;
      }

      // Regular user message
      const text = parts.filter((p) => p.text).map((p) => p.text).join('');
      result.push({ role: 'user', content: text });
      continue;
    }

    // Simple message with content string
    if (typeof m.content === 'string') {
      result.push({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content });
    }
  }

  return result;
}

// ─── Anthropic Provider ──────────────────────────────────

async function callAnthropicText(
  apiKey: string,
  modelId: string,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: options?.maxTokens ?? 4096,
    messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsgs.length > 0) {
    body.system = systemMsgs.map((s) => s.content).join('\n');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  return ((data.content as { type: string; text?: string }[])?.find((b) => b.type === 'text')?.text ?? '').trim();
}

async function callAnthropicWithTools(
  apiKey: string,
  modelId: string,
  messages: unknown[],
  systemPrompt: string,
  tools: ToolDeclaration[],
): Promise<LLMToolResponse> {
  const anthropicMessages = convertToAnthropicMessages(messages);

  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  const contentBlocks = (data.content ?? []) as { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];

  const textParts: string[] = [];
  const toolCalls: LLMToolCall[] = [];

  for (const block of contentBlocks) {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text);
    }
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name!,
        args: block.input ?? {},
      });
    }
  }

  // rawContent: Anthropic-native format for multi-turn
  const rawContent = {
    role: 'assistant',
    content: contentBlocks,
  };

  return { textParts, toolCalls, rawContent };
}

function convertToAnthropicMessages(
  geminiMessages: unknown[],
): { role: string; content: string | unknown[] }[] {
  const result: { role: string; content: string | unknown[] }[] = [];

  for (const msg of geminiMessages) {
    const m = msg as { role: string; content?: unknown; parts?: unknown[] };

    // Already in Anthropic format
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      result.push(m as { role: string; content: unknown[] });
      continue;
    }
    if (m.role === 'user' && Array.isArray(m.content)) {
      result.push(m as { role: string; content: unknown[] });
      continue;
    }

    // Gemini-native format
    if (m.parts && Array.isArray(m.parts)) {
      const parts = m.parts as GeminiAPIPart[];

      if (m.role === 'model') {
        const content: unknown[] = [];
        for (const p of parts) {
          if (p.text) content.push({ type: 'text', text: p.text });
          if (p.functionCall) {
            content.push({
              type: 'tool_use',
              id: `toolu_${p.functionCall.name}_${Date.now()}`,
              name: p.functionCall.name,
              input: p.functionCall.args ?? {},
            });
          }
        }
        result.push({ role: 'assistant', content });
        continue;
      }

      // Function responses (user role in Gemini)
      const funcResponses = parts.filter((p) => p.functionResponse);
      if (funcResponses.length > 0) {
        result.push({
          role: 'user',
          content: funcResponses.map((fr) => ({
            type: 'tool_result',
            tool_use_id: fr.functionResponse!.name,
            content: typeof fr.functionResponse!.response === 'string'
              ? fr.functionResponse!.response
              : JSON.stringify(fr.functionResponse!.response),
          })),
        });
        continue;
      }

      // Regular user message
      const text = parts.filter((p) => p.text).map((p) => p.text).join('');
      result.push({ role: 'user', content: text });
      continue;
    }

    // Simple string content
    if (typeof m.content === 'string') {
      result.push({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content });
    }
  }

  return result;
}
