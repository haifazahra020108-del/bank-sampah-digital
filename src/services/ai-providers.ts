/**
 * Registry Provider AI dan Adapter HTTP untuk Bank Sampah Digital.
 *
 * Mengabstraksi pemanggilan API ke provider yang didukung (Groq, NVIDIA)
 * dengan interface OpenAI-compatible, penanganan error tersanitasi,
 * pengambilan daftar model, dan pengujian koneksi server-side.
 */

export interface ModelOption {
  id: string;
  label: string;
  isRecommended?: boolean;
  contextWindow?: number;
}

export interface ProviderDefinition {
  id: 'groq' | 'nvidia' | 'gemini';
  name: string;
  description: string;
  baseUrl: string;
  allowedBaseUrls: string[];
  modelsEndpoint: string;
  defaultPrimary: string;
  defaultFallback?: string | null;
  curatedModels: ModelOption[];
  authHeaderPrefix: string;
  docsUrl: string;
}

export const SUPPORTED_PROVIDERS: Record<'groq' | 'nvidia' | 'gemini', ProviderDefinition> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Inference super cepat berbasis LPU dengan latensi sangat rendah untuk model open-source.',
    baseUrl: 'https://api.groq.com/openai/v1',
    allowedBaseUrls: ['https://api.groq.com/openai/v1'],
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    defaultPrimary: 'openai/gpt-oss-120b',
    defaultFallback: 'openai/gpt-oss-20b',
    authHeaderPrefix: 'Bearer',
    docsUrl: 'https://console.groq.com/keys',
    curatedModels: [
      {
        id: 'openai/gpt-oss-120b',
        label: 'OpenAI GPT-OSS 120B (Terkuat & Akurat - Rekomendasi Utama)',
        isRecommended: true,
        contextWindow: 131072,
      },
      {
        id: 'openai/gpt-oss-20b',
        label: 'OpenAI GPT-OSS 20B (Cepat & Ringan - Rekomendasi Fallback)',
        contextWindow: 131072,
      },
      {
        id: 'llama-3.3-70b-versatile',
        label: 'Meta Llama 3.3 70B Versatile',
        contextWindow: 128000,
      },
      {
        id: 'llama-3.1-8b-instant',
        label: 'Meta Llama 3.1 8B Instant (Sangat Cepat)',
        contextWindow: 128000,
      },
      {
        id: 'mixtral-8x7b-32768',
        label: 'Mistral Mixtral 8x7B (Konteks 32k)',
        contextWindow: 32768,
      },
      {
        id: 'gemma2-9b-it',
        label: 'Google Gemma 2 9B IT',
        contextWindow: 8192,
      },
    ],
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'Katalog API NVIDIA & inference microservices terakselerasi GPU untuk enterprise.',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    allowedBaseUrls: ['https://integrate.api.nvidia.com/v1'],
    modelsEndpoint: 'https://integrate.api.nvidia.com/v1/models',
    defaultPrimary: 'openai/gpt-oss-20b',
    defaultFallback: null,
    authHeaderPrefix: 'Bearer',
    docsUrl: 'https://build.nvidia.com',
    curatedModels: [
      {
        id: 'openai/gpt-oss-20b',
        label: 'OpenAI GPT-OSS 20B (NVIDIA Hosted)',
        isRecommended: true,
      },
      {
        id: 'meta/llama-3.3-70b-instruct',
        label: 'Meta Llama 3.3 70B Instruct',
      },
      {
        id: 'meta/llama-3.1-70b-instruct',
        label: 'Meta Llama 3.1 70B Instruct',
      },
      {
        id: 'mistralai/mixtral-8x7b-instruct-v0.1',
        label: 'Mistral Mixtral 8x7B Instruct v0.1',
      },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Model Gemini melalui endpoint OpenAI-compatible Google.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    allowedBaseUrls: ['https://generativelanguage.googleapis.com/v1beta/openai'],
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    defaultPrimary: 'gemini-2.0-flash',
    defaultFallback: 'gemini-1.5-flash',
    authHeaderPrefix: 'Bearer',
    docsUrl: 'https://aistudio.google.com/apikey',
    curatedModels: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', isRecommended: true },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
  },
};

export interface ConnectionTestResult {
  success: boolean;
  status:
    | 'SUCCESS'
    | 'INVALID_KEY'
    | 'MODEL_NOT_FOUND'
    | 'RATE_LIMIT'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'PROVIDER_ERROR';
  latencyMs: number;
  message: string;
  modelTested: string;
  fallbackTested?: boolean;
}

/**
 * Validasi apakah provider didukung oleh sistem.
 */
export function isValidProvider(provider: string): provider is 'groq' | 'nvidia' | 'gemini' {
  return provider === 'groq' || provider === 'nvidia' || provider === 'gemini';
}

/**
 * Validasi Base URL provider terhadap daftar host HTTPS resmi.
 */
export function normalizeAndValidateBaseUrl(provider: string, baseUrl?: string | null): string {
  const def = getProviderDefinition(provider);
  const candidate = (baseUrl && baseUrl.trim().length > 0 ? baseUrl.trim() : def.baseUrl).replace(/\/+$/, '');
  if (!def.allowedBaseUrls.includes(candidate)) {
    throw new Error(`Base URL "${candidate}" tidak diizinkan untuk provider ${def.name}.`);
  }
  if (!candidate.toLowerCase().startsWith('https://')) {
    throw new Error('Base URL harus menggunakan HTTPS.');
  }
  return candidate;
}

/**
 * Mendapatkan definisi provider berdasarkan ID.
 */
export function getProviderDefinition(provider: string): ProviderDefinition {
  if (!isValidProvider(provider)) {
    throw new Error(`Provider "${provider}" tidak didukung oleh sistem.`);
  }
  return SUPPORTED_PROVIDERS[provider];
}

/**
 * Mengambil daftar model langsung dari endpoint provider (/v1/models).
 * Jika gagal atau tidak dapat diakses, otomatis mengembalikan daftar model kurasi statis
 * dengan metadata yang jelas.
 */
export async function fetchRemoteModels(
  providerId: string,
  apiKey: string
): Promise<{ models: ModelOption[]; isLive: boolean; error?: string }> {
  const provider = getProviderDefinition(providerId);

  try {
    const response = await fetch(provider.modelsEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `${provider.authHeaderPrefix} ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // Timeout 10s untuk list models
    });

    if (!response.ok) {
      return {
        models: provider.curatedModels,
        isLive: false,
        error: `Provider mengembalikan HTTP ${response.status}`,
      };
    }

    const json = await response.json();
    const rawData = Array.isArray(json?.data) ? json.data : [];

    // Filter & petakan model yang relevan untuk text/chat
    const fetchedModels: ModelOption[] = rawData
      .map((m: { id: string }) => m?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      // Filter model non-chat/audio/embedding jika ada
      .filter((id: string) => !id.includes('whisper') && !id.includes('embed') && !id.includes('tts'))
      .sort((a: string, b: string) => a.localeCompare(b))
      .map((id: string) => ({
        id,
        label: id,
        isRecommended: id === provider.defaultPrimary,
      }));

    if (fetchedModels.length > 0) {
      return { models: fetchedModels, isLive: true };
    }

    return { models: provider.curatedModels, isLive: false };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      models: provider.curatedModels,
      isLive: false,
      error: `Gagal memuat live models: ${errorMsg}`,
    };
  }
}

/**
 * Menguji koneksi ke provider AI menggunakan kredensial dan model yang ditentukan.
 * Mengirimkan prompt minimal non-bisnis ("Ping. Jawab 'OK'") tanpa mengakses data bank sampah.
 */
export async function testProviderConnection(params: {
  provider: string;
  apiKey: string;
  modelPrimary: string;
  modelFallback?: string | null;
  baseUrl?: string | null;
  timeoutMs?: number;
}): Promise<ConnectionTestResult> {
  const { provider: providerId, apiKey, modelPrimary, baseUrl, timeoutMs = 15000 } = params;

  if (!isValidProvider(providerId)) {
    return {
      success: false,
      status: 'PROVIDER_ERROR',
      latencyMs: 0,
      message: `Provider "${providerId}" tidak didukung.`,
      modelTested: modelPrimary,
    };
  }

  const def = SUPPORTED_PROVIDERS[providerId];
  const resolvedBaseUrl = normalizeAndValidateBaseUrl(providerId, baseUrl);
  const url = `${resolvedBaseUrl}/chat/completions`;

  const probePayload = {
    model: modelPrimary,
    messages: [
      { role: 'system', content: 'You are a test ping agent. Answer in one word.' },
      { role: 'user', content: 'Ping' },
    ],
    max_tokens: 80,
    temperature: 0.1,
    stream: false,
  };

  const tStart = performance.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `${def.authHeaderPrefix} ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(probePayload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Math.round(performance.now() - tStart);

    if (!res.ok) {
      let serverErrorSnippet = '';
      try {
        const errJson = await res.json();
        if (typeof errJson?.error?.message === 'string') {
          serverErrorSnippet = errJson.error.message.slice(0, 150);
        }
      } catch {
        // Abaikan parse error jika body bukan JSON
      }

      console.warn(
        `[AiTestProbe][${providerId}] HTTP ${res.status} (${latencyMs}ms) model=${modelPrimary}: ${serverErrorSnippet || 'No error details'}`
      );

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          status: 'INVALID_KEY',
          latencyMs,
          message: 'Kredensial API Key ditolak oleh provider (HTTP 401/403). Pastikan key valid dan aktif.',
          modelTested: modelPrimary,
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          status: 'MODEL_NOT_FOUND',
          latencyMs,
          message: `Model "${modelPrimary}" tidak ditemukan atau tidak tersedia untuk akun provider ini (HTTP 404).`,
          modelTested: modelPrimary,
        };
      }

      if (res.status === 429) {
        return {
          success: false,
          status: 'RATE_LIMIT',
          latencyMs,
          message: 'Batas laju/kuota API provider terlampaui (HTTP 429 Rate Limit). Coba beberapa saat lagi.',
          modelTested: modelPrimary,
        };
      }

      if (res.status >= 500) {
        return {
          success: false,
          status: 'PROVIDER_ERROR',
          latencyMs,
          message: `Layanan provider (${def.name}) sedang mengalami gangguan server internal (HTTP ${res.status}). Silakan coba beberapa saat lagi.`,
          modelTested: modelPrimary,
        };
      }

      return {
        success: false,
        status: 'PROVIDER_ERROR',
        latencyMs,
        message: `Provider mengembalikan kesalahan HTTP ${res.status}.`,
        modelTested: modelPrimary,
      };
    }

    interface ChatCompletionResponse {
      choices?: Array<{
        index?: number;
        finish_reason?: string | null;
        message?: {
          role?: string;
          content?: string | null;
          reasoning?: string | null;
          reasoning_content?: string | null;
        };
      }>;
      usage?: {
        total_tokens?: number;
      };
    }

    let data: ChatCompletionResponse | null = null;
    try {
      data = (await res.json()) as ChatCompletionResponse;
    } catch {
      console.warn(`[AiTestProbe][${providerId}] Respons HTTP 200 tetapi bukan format JSON valid (${latencyMs}ms)`);
      return {
        success: false,
        status: 'PROVIDER_ERROR',
        latencyMs,
        message: 'Provider mengembalikan respons non-JSON yang tidak valid.',
        modelTested: modelPrimary,
      };
    }

    const choice = data?.choices?.[0];
    const message = choice?.message;

    // Ekstrak teks konten atau reasoning dari respons
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    const reasoning = typeof message?.reasoning === 'string'
      ? message.reasoning.trim()
      : typeof message?.reasoning_content === 'string'
      ? message.reasoning_content.trim()
      : '';

    const textResponse = content || reasoning;

    if (!textResponse || textResponse.length === 0) {
      console.warn(
        `[AiTestProbe][${providerId}] Respons kosong dari model=${modelPrimary} (${latencyMs}ms). finish_reason=${choice?.finish_reason ?? 'null'}`
      );
      return {
        success: false,
        status: 'PROVIDER_ERROR',
        latencyMs,
        message: 'Provider mengembalikan respons kosong atau struktur tidak dikenali.',
        modelTested: modelPrimary,
      };
    }

    console.log(
      `[AiTestProbe][${providerId}] OK model=${modelPrimary} httpStatus=${res.status} latency=${latencyMs}ms chars=${textResponse.length} finishReason=${choice?.finish_reason ?? 'stop'}`
    );

    return {
      success: true,
      status: 'SUCCESS',
      latencyMs,
      message: `Koneksi berhasil ke ${def.name}. Model "${modelPrimary}" merespons dalam ${latencyMs}ms.`,
      modelTested: modelPrimary,
    };
  } catch (error: unknown) {
    const latencyMs = Math.round(performance.now() - tStart);
    const err = error as Record<string, unknown> & { name?: string; message?: string; code?: string };

    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      err?.message?.toLowerCase().includes('timeout');

    console.error(
      `[AiTestProbe][${providerId}] Error model=${modelPrimary} latency=${latencyMs}ms errName=${err?.name ?? 'Error'} code=${err?.code ?? 'NONE'}`
    );

    if (isTimeout) {
      return {
        success: false,
        status: 'TIMEOUT',
        latencyMs,
        message: `Koneksi ke ${def.name} timeout (melebihi batas ${timeoutMs / 1000} detik).`,
        modelTested: modelPrimary,
      };
    }

    return {
      success: false,
      status: 'NETWORK_ERROR',
      latencyMs,
      message: 'Gagal terhubung ke jaringan host provider. Pastikan koneksi internet server stabil.',
      modelTested: modelPrimary,
    };
  }
}

