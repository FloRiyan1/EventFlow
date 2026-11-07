import { parsePlantUml, type PlantUmlParseResult } from './plantUmlImport';
import { exportModelsToPlantUml } from './plantUmlExport';
import type { Project } from './schema';

export interface AiClientConfig {
  /** OpenAI-compatible Base URL, e.g. "http://localhost:3000/api" (Open WebUI) or "http://localhost:11434/v1" (Ollama) */
  baseURL: string;
  /** API Key (optional for local Ollama, required for authenticated Open WebUI / OpenAI) */
  apiKey?: string;
  /** Model identifier, e.g. "llama3", "qwen2.5-coder", "mistral", "gpt-4o" */
  model: string;
  /** Temperature for determinism, defaults to 0.2 */
  temperature?: number;
}

export interface AiGenerateOptions {
  /** User instruction, e.g. "Füge eine Klasse 'Invoice' mit Attributen id, amount und Status hinzu." */
  userInstruction: string;
  /** Existing context (e.g. current PlantUML code or class diagram) */
  currentContext?: string;
  /** Custom system prompt (optional) */
  systemPrompt?: string;
  /** Request timeout in milliseconds (defaults to 60000ms) */
  timeoutMs?: number;
}

export interface AiGenerateResult {
  pumlCode: string;
  rawText: string;
  parsed: PlantUmlParseResult;
}

export const DEFAULT_AI_CONFIG: AiClientConfig = {
  baseURL: 'http://localhost:3000/api',
  apiKey: '',
  model: 'llama3',
  temperature: 0.2,
};

export const AI_SERVER_PRESETS: Array<{
  name: string;
  description: string;
  baseURL: string;
  defaultModel: string;
}> = [
  {
    name: 'Open WebUI',
    description: 'Lokales Open WebUI (Default Port 3000)',
    baseURL: 'http://localhost:3000/api',
    defaultModel: 'llama3',
  },
  {
    name: 'Ollama',
    description: 'Direktes Ollama API (Default Port 11434)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3:latest',
  },
  {
    name: 'LM Studio',
    description: 'LM Studio Local Server (Default Port 1234)',
    baseURL: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
  {
    name: 'vLLM / LocalAI',
    description: 'vLLM oder LocalAI (Default Port 8080)',
    baseURL: 'http://localhost:8080/v1',
    defaultModel: 'default',
  },
  {
    name: 'OpenAI (Cloud)',
    description: 'Offizielle OpenAI API',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
];

/**
 * Extracts a PlantUML code block (@startuml ... @enduml) from raw text,
 * handling markdown code fences, backticks, and partial wrappings.
 */
export function extractPlantUmlFromText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Die KI-Antwort war leer.');
  }

  // 1. Regex search for @startuml ... @enduml
  const match = rawText.match(/@startuml[\s\S]*?@enduml/i);
  if (match) {
    return match[0].trim();
  }

  // 2. Fallback: Check if response is wrapped in ```plantuml ... ``` or ``` ... ```
  const fenceMatch = rawText.match(/```(?:plantuml|puml)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1].trim()) {
    const inner = fenceMatch[1].trim();
    if (/@startuml/i.test(inner)) {
      const innerMatch = inner.match(/@startuml[\s\S]*?@enduml/i);
      if (innerMatch) return innerMatch[0].trim();
    }
    return `@startuml\n${inner}\n@enduml`;
  }

  // 3. Fallback: Check if response contains class definitions without start/end tags
  if (/\bclass\s+["']?[A-Za-z0-9_]+["']?\s*\{/i.test(rawText)) {
    return `@startuml\n${rawText.trim()}\n@enduml`;
  }

  throw new Error(
    'Kein gültiger PlantUML-Block (@startuml ... @enduml) in der KI-Antwort gefunden.\nRohantwort:\n' +
      rawText.slice(0, 300)
  );
}

/**
 * Builds the system prompt instructing the model to generate strictly PlantUML code.
 */
export function buildAiSystemPrompt(currentContext = ''): string {
  const contextSection = currentContext.trim()
    ? `\n\nBestehender Projekt-Kontext (aktuelle Datenmodelle & Klassen):\n${currentContext.trim()}\n`
    : '';

  return `Du bist ein erfahrener Software-Architekt und PlantUML-Generator.
Deine Aufgabe ist es, Datenmodelle und Klassendiagramme basierend auf den Anweisungen des Benutzers zu entwerfen oder zu erweitern.

REGELN:
1. Antworte AUSSCHLIESSLICH mit gültigem PlantUML-Code.
2. Starte deine Antwort direkt mit @startuml und beende sie mit @enduml.
3. Verwende KEINE Begleittexte, keine Höflichkeitsfloskeln und keine Erklärungen.
4. Deklariere Modelle mit Klassensyntax:
   class "KlassenName" {
     +attributName: Typ
     +optionalesAttribut: Typ?
   }
5. Relationen zwischen Klassen kannst du mit Pfeilen definieren (z. B. Order --> Customer : gehört zu, Order *-- OrderItem).
6. Bestehende Modelle aus dem Kontext können beibehalten, aktualisiert oder um neue Klassen ergänzt werden.${contextSection}`;
}

/**
 * Normalizes an OpenAI-compatible baseURL by removing trailing slashes and ensuring the correct chat endpoint.
 */
export function resolveChatCompletionsUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

/**
 * Normalizes an OpenAI-compatible baseURL for fetching available models.
 */
export function resolveModelsUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.replace(/\/chat\/completions$/, '/models');
  }
  return `${trimmed}/models`;
}

/**
 * Calls an OpenAI-compatible chat completion endpoint to generate PlantUML code.
 */
export async function generatePumlWithAi(
  config: AiClientConfig,
  options: AiGenerateOptions
): Promise<AiGenerateResult> {
  const url = resolveChatCompletionsUrl(config.baseURL);
  const systemPrompt = options.systemPrompt ?? buildAiSystemPrompt(options.currentContext);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey && config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const payload = {
    model: config.model || 'llama3',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: options.userInstruction,
      },
    ],
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.2,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 90000
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Die KI-Anfrage hat das Zeitlimit von ${(options.timeoutMs ?? 90000) / 1000}s überschritten.`);
    }
    throw new Error(
      `Verbindung zur KI unter "${config.baseURL}" fehlgeschlagen. Prüfe, ob dein lokaler KI-Server (z.B. Open WebUI oder Ollama) gestartet ist und CORS erlaubt.\nFehler: ${err.message || String(err)}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`KI-Server Fehler (HTTP ${response.status}): ${errorDetail || response.statusText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Der KI-Server hat eine leere oder unerwartete Antwortstruktur zurückgegeben.');
  }

  const pumlCode = extractPlantUmlFromText(rawText);
  const parsed = parsePlantUml(pumlCode);

  return {
    pumlCode,
    rawText,
    parsed,
  };
}

/**
 * Fetches the list of available model names from an OpenAI-compatible /models endpoint.
 */
export async function fetchAiAvailableModels(
  baseURL: string,
  apiKey?: string,
  timeoutMs = 10000
): Promise<string[]> {
  const url = resolveModelsUrl(baseURL);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`Konnte keine Modelle von "${url}" abrufen: ${err.message || String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Modell-Abruf fehlgeschlagen (HTTP ${response.status})`);
  }

  const data = await response.json();
  const models: string[] = [];

  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item && typeof item.id === 'string') {
        models.push(item.id);
      } else if (item && typeof item.name === 'string') {
        models.push(item.name);
      }
    }
  } else if (Array.isArray(data?.models)) {
    // Ollama native format { models: [{ name: "llama3:latest" }] }
    for (const item of data.models) {
      if (item && typeof item.name === 'string') {
        models.push(item.name);
      } else if (typeof item === 'string') {
        models.push(item);
      }
    }
  }

  return models;
}

/**
 * Helper to generate current project models context as PlantUML for the AI.
 */
export function getProjectModelsContext(project: Project): string {
  if (!project || !project.models || project.models.length === 0) {
    return '';
  }
  return exportModelsToPlantUml(project);
}
