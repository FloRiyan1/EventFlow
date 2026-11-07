import { describe, expect, it, vi } from 'vitest';
import {
  extractPlantUmlFromText,
  buildAiSystemPrompt,
  resolveChatCompletionsUrl,
  resolveModelsUrl,
  generatePumlWithAi,
  fetchAiAvailableModels,
  getProjectModelsContext,
  createEmptyProject,
  createModel,
  type AiClientConfig,
} from './index';

describe('Local AI Client (aiClient)', () => {
  describe('extractPlantUmlFromText', () => {
    it('extracts standard @startuml ... @enduml block', () => {
      const raw = `Hier ist der Code:
@startuml
class Invoice {
  +id: String
  +amount: double
}
@enduml
Hoffe das hilft!`;

      const result = extractPlantUmlFromText(raw);
      expect(result).toBe(`@startuml\nclass Invoice {\n  +id: String\n  +amount: double\n}\n@enduml`);
    });

    it('extracts from markdown code block', () => {
      const raw = '```plantuml\n@startuml\nclass User { +name: String }\n@enduml\n```';
      const result = extractPlantUmlFromText(raw);
      expect(result).toBe('@startuml\nclass User { +name: String }\n@enduml');
    });

    it('wraps raw class definition if startuml tags are missing', () => {
      const raw = 'class Customer {\n  +id: String\n  +email: String\n}';
      const result = extractPlantUmlFromText(raw);
      expect(result).toContain('@startuml');
      expect(result).toContain('class Customer');
      expect(result).toContain('@enduml');
    });

    it('throws error when no PlantUML content is found', () => {
      expect(() => extractPlantUmlFromText('Das ist nur Text ohne Klassen.')).toThrow(
        /Kein gültiger PlantUML-Block/
      );
    });
  });

  describe('URL resolvers', () => {
    it('resolves chat completions URL correctly', () => {
      expect(resolveChatCompletionsUrl('http://localhost:3000/api')).toBe(
        'http://localhost:3000/api/chat/completions'
      );
      expect(resolveChatCompletionsUrl('http://localhost:11434/v1/')).toBe(
        'http://localhost:11434/v1/chat/completions'
      );
      expect(resolveChatCompletionsUrl('http://localhost:11434/v1/chat/completions')).toBe(
        'http://localhost:11434/v1/chat/completions'
      );
    });

    it('resolves models URL correctly', () => {
      expect(resolveModelsUrl('http://localhost:3000/api')).toBe(
        'http://localhost:3000/api/models'
      );
      expect(resolveModelsUrl('http://localhost:11434/v1/chat/completions')).toBe(
        'http://localhost:11434/v1/models'
      );
    });
  });

  describe('buildAiSystemPrompt', () => {
    it('includes context when provided', () => {
      const prompt = buildAiSystemPrompt('@startuml\nclass Existing {}\n@enduml');
      expect(prompt).toContain('Bestehender Projekt-Kontext');
      expect(prompt).toContain('class Existing');
    });

    it('omits context section when empty', () => {
      const prompt = buildAiSystemPrompt('');
      expect(prompt).not.toContain('Bestehender Projekt-Kontext');
    });
  });

  describe('getProjectModelsContext', () => {
    it('returns empty string when project has no models', () => {
      const p = createEmptyProject('Empty');
      expect(getProjectModelsContext(p)).toBe('');
    });

    it('returns valid PlantUML string when project has models', () => {
      const p = createEmptyProject('Shop');
      p.models.push(createModel('Article', [{ id: 'f1', name: 'title', type: 'String', nullable: false }]));
      const ctx = getProjectModelsContext(p);
      expect(ctx).toContain('@startuml');
      expect(ctx).toContain('class "Article"');
      expect(ctx).toContain('+title: String');
    });
  });

  describe('generatePumlWithAi (mock fetch)', () => {
    it('calls OpenAI endpoint and parses response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: `@startuml
class Invoice {
  +id: String
  +amount: double
}
@enduml`,
            },
          },
        ],
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      try {
        const config: AiClientConfig = {
          baseURL: 'http://localhost:3000/api',
          apiKey: 'test-key',
          model: 'qwen2.5-coder',
        };

        const result = await generatePumlWithAi(config, {
          userInstruction: 'Erstelle Invoice Modell',
        });

        expect(result.pumlCode).toContain('class Invoice');
        expect(result.parsed.models.length).toBe(1);
        expect(result.parsed.models[0].name).toBe('Invoice');
        expect(result.parsed.models[0].fields.length).toBe(2);

        expect(globalThis.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('handles server HTTP error gracefully', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Ungültiger API-Key' } }),
      } as Response);

      try {
        const config: AiClientConfig = {
          baseURL: 'http://localhost:3000/api',
          model: 'llama3',
        };

        await expect(
          generatePumlWithAi(config, { userInstruction: 'Test' })
        ).rejects.toThrow(/HTTP 401/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('fetchAiAvailableModels (mock fetch)', () => {
    it('parses OpenAI /models response', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'llama3:latest' }, { id: 'qwen2.5-coder:7b' }],
        }),
      } as Response);

      try {
        const models = await fetchAiAvailableModels('http://localhost:3000/api');
        expect(models).toEqual(['llama3:latest', 'qwen2.5-coder:7b']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
