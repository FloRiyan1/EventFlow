import React, { useState, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  generatePumlWithAi,
  fetchAiAvailableModels,
  getProjectModelsContext,
  importPlantUmlIntoProject,
  AI_SERVER_PRESETS,
  DEFAULT_AI_CONFIG,
  type AiClientConfig,
  type AiGenerateResult,
  type PlantUmlImportStats,
} from '@eventflow/core';
import {
  Bot,
  Sparkles,
  Server,
  Settings,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Database,
  Check,
  AlertTriangle,
  X,
  Copy,
  Sliders,
  Zap,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

const STORAGE_KEY = 'eventflow_ai_config';

function loadStoredAiConfig(): AiClientConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseURL: parsed.baseURL || DEFAULT_AI_CONFIG.baseURL,
        apiKey: parsed.apiKey || '',
        model: parsed.model || DEFAULT_AI_CONFIG.model,
        temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.2,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_AI_CONFIG };
}

function saveStoredAiConfig(cfg: AiClientConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

const QUICK_PROMPTS = [
  {
    title: 'Rechnungswesen',
    prompt: 'Erstelle eine Klasse "Invoice" mit id, invoiceNumber, amount, taxRate, status, dueDate und verknüpfe sie mit "Customer" und einer Liste von "InvoiceItem".',
  },
  {
    title: 'E-Commerce',
    prompt: 'Erstelle ein Datenmodell für einen Shop: Product (sku, name, price, stock), Category, Order, OrderItem und Customer mit Adressen.',
  },
  {
    title: 'Auth & Berechtigungen',
    prompt: 'Erstelle Klassen für User (id, email, passwordHash, active), Role (id, name, permissions) und Session (token, expiresAt, ipAddress).',
  },
  {
    title: 'Projektmanagement',
    prompt: 'Erstelle Projekt, Aufgabe (Task mit status, priority, estimatedHours), Kommentar und Tag mit Relationen.',
  },
];

export const AiImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);

  // Config State
  const [config, setConfig] = useState<AiClientConfig>(loadStoredAiConfig);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Prompt & Generation State
  const [userInstruction, setUserInstruction] = useState('');
  const [sendContext, setSendContext] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiGenerateResult | null>(null);

  // Import Options
  const [importTarget, setImportTarget] = useState<'models-only' | 'current-board' | 'new-board'>('models-only');
  const [newBoardName, setNewBoardName] = useState('');
  const [mergeModels, setMergeModels] = useState(true);
  const [copied, setCopied] = useState(false);

  // Save config on changes
  useEffect(() => {
    saveStoredAiConfig(config);
  }, [config]);

  // Reset transient error when opening
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  // Fetch models from local AI server
  const handleFetchModels = async () => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const models = await fetchAiAvailableModels(config.baseURL, config.apiKey);
      setAvailableModels(models);
      if (models.length > 0) {
        onShowToast?.(`✅ ${models.length} Modelle gefunden!`);
        if (!models.includes(config.model)) {
          setConfig((prev) => ({ ...prev, model: models[0] }));
        }
      } else {
        onShowToast?.('Verbindung hergestellt, aber keine Modell-Liste zurückgegeben.');
      }
    } catch (err: any) {
      setModelsError(err.message || String(err));
      onShowToast?.('❌ Konnte keine Modelle abrufen');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Perform AI Generation
  const handleGenerate = async (directImport = false) => {
    if (!userInstruction.trim()) {
      setError('Bitte gib eine Anweisung für die KI ein.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const context = sendContext ? getProjectModelsContext(project) : '';

    try {
      const genResult = await generatePumlWithAi(config, {
        userInstruction: userInstruction.trim(),
        currentContext: context,
      });

      setResult(genResult);

      if (directImport) {
        executeImport(genResult);
      } else {
        onShowToast?.(`✨ ${genResult.parsed.models.length} Modelle von KI generiert!`);
      }
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setError(err.message || String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  // Import Result into EventFlow Project
  const executeImport = (targetResult: AiGenerateResult) => {
    try {
      store.update((draft) => {
        let stats: PlantUmlImportStats;

        if (importTarget === 'new-board') {
          const boardName = newBoardName.trim() || targetResult.parsed.title || 'KI-Board';
          stats = importPlantUmlIntoProject(draft, targetResult.parsed, {
            newBoardName: boardName,
            mergeModels,
            addNodesToBoard: true,
          });
        } else if (importTarget === 'current-board') {
          stats = importPlantUmlIntoProject(draft, targetResult.parsed, {
            targetBoardId: activeBoardId,
            mergeModels,
            addNodesToBoard: true,
          });
        } else {
          // 'models-only'
          stats = importPlantUmlIntoProject(draft, targetResult.parsed, {
            mergeModels,
            addNodesToBoard: false,
          });
        }

        const modelCount = stats.createdModels.length;
        const msg =
          modelCount > 0
            ? `🎉 ${modelCount} Modell${modelCount === 1 ? '' : 'e'} erfolgreich ins Projekt importiert!`
            : 'Modelle erfolgreich aktualisiert!';
        onShowToast?.(msg);
      });

      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setError(`Fehler beim Importieren: ${err.message || String(err)}`);
    }
  };

  const handleCopyPuml = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.pumlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('PlantUML in Zwischenablage kopiert');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Lokale KI Datenmodellierung
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60 font-mono">
                  Open WebUI / Ollama / OpenAI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nutze deine lokale KI (z.B. Llama 3, Qwen-Coder) zur automatischen Erstellung und Erweiterung deiner Datenmodelle.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isSettingsOpen
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="API-URL & Modell einstellen"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>KI-Server ({config.model})</span>
              {isSettingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Drawer */}
        {isSettingsOpen && (
          <div className="px-6 py-4 bg-purple-50/50 dark:bg-slate-950/80 border-b border-purple-200 dark:border-purple-900/40 space-y-3 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-purple-500" />
                <span>KI-Server Konfiguration (OpenAI-kompatibel)</span>
              </span>

              {/* Server Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Vorlagen:</span>
                {AI_SERVER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setConfig((prev) => ({
                        ...prev,
                        baseURL: preset.baseURL,
                        model: preset.defaultModel,
                      }));
                      onShowToast?.(`Vorlage "${preset.name}" geladen`);
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Base URL */}
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Base URL (API-Endpunkt)
                </label>
                <input
                  type="text"
                  value={config.baseURL}
                  onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
                  placeholder="http://localhost:3000/api"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* API Key */}
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  API Key (optional für lokales Ollama)
                </label>
                <input
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk-... oder leer lassen"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Model Name & Fetch */}
              <div className="sm:col-span-3 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Modell
                  </label>
                  <button
                    onClick={handleFetchModels}
                    disabled={isLoadingModels}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isLoadingModels ? 'animate-spin' : ''}`} />
                    <span>Modelle laden</span>
                  </button>
                </div>
                {availableModels.length > 0 ? (
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    placeholder="llama3, qwen2.5-coder..."
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                )}
              </div>

              {/* Temperature */}
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400" title="Niedrig für exakte Syntax">
                  Temp
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.temperature ?? 0.2}
                  onChange={(e) =>
                    setConfig({ ...config, temperature: parseFloat(e.target.value) || 0.2 })
                  }
                  className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            {modelsError && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{modelsError}</span>
              </div>
            )}
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Column: Prompting & Instructions */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            {/* Top Toolbar: Quick Prompts & Context Toggle */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Beispiele:
                </span>
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.title}
                    onClick={() => setUserInstruction(qp.prompt)}
                    className="px-2 py-0.5 text-[11px] bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-950/50 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {qp.title}
                  </button>
                ))}
              </div>

              {/* Send Context Toggle */}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendContext}
                  onChange={(e) => setSendContext(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span title="Sendet bestehende Modelle als Referenz mit, damit die KI bestehende Klassen erweitern kann">
                  Aktuelle Modelle ({project.models.length}) als Kontext mitsenden
                </span>
              </label>
            </div>

            {/* Prompt Textarea */}
            <div className="flex-1 p-4 flex flex-col min-h-0 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Was soll die KI modellieren oder anpassen?</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (z.B. neue Klassen, Attribute, Relationen oder Erweiterungen)
                </span>
              </label>
              <textarea
                value={userInstruction}
                onChange={(e) => setUserInstruction(e.target.value)}
                placeholder="z.B. Füge ein Modell 'Invoice' mit Attributen id, amount und status hinzu und verknüpfe es mit 'Customer'. Oder: Erstelle ein komplettes Datenmodell für ein Fuhrpark-Management..."
                className="flex-1 w-full p-3 font-sans text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none leading-relaxed"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mb-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Fehler bei der KI-Generierung:</div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap">{error}</pre>
                </div>
              </div>
            )}

            {/* Prompt Action Buttons */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-500" />
                <span>Ziel-Server: <code className="font-mono text-[11px] text-purple-600 dark:text-purple-400">{config.baseURL}</code></span>
              </div>

              <div className="flex items-center gap-2">
                {/* 1-Click Direct Import */}
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={isGenerating || !userInstruction.trim()}
                  className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors border border-purple-300 dark:border-purple-800/80 shadow-xs disabled:opacity-50"
                  title="Generiert den Code und importiert die Modelle sofort in das Projekt"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>1-Klick: Generieren & Importieren</span>
                </button>

                {/* Generate & Preview */}
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={isGenerating || !userInstruction.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>KI generiert...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generieren & Vorschau</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Result & Import Configuration */}
          <div className="w-full md:w-[480px] flex flex-col min-h-0 bg-white dark:bg-slate-900">
            {/* Header of Preview */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Ergebnis & Vorschau
                </span>
              </div>

              {result && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                    {result.parsed.models.length} Modelle erkannt
                  </span>
                  <button
                    onClick={handleCopyPuml}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                    title="PlantUML-Code kopieren"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Preview Content */}
            <div className="flex-1 flex flex-col p-3 overflow-y-auto min-h-0 space-y-3">
              {!result ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 space-y-2">
                  <Bot className="w-10 h-10 stroke-1 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-medium">Noch kein Ergebnis generiert</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Gib links eine Anweisung ein und klicke auf "Generieren & Vorschau", um die erkannten Klassen zu sehen.
                  </p>
                </div>
              ) : (
                <>
                  {/* Recognized Models Cards */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Erkannte Klassen ({result.parsed.models.length}):
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {result.parsed.models.map((m, idx) => (
                        <div
                          key={idx}
                          className="border border-purple-200/70 dark:border-purple-900/40 rounded-lg p-2.5 bg-purple-50/40 dark:bg-purple-950/20"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-purple-100 dark:border-purple-900/30">
                            <span>{m.name}</span>
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                              {m.fields.length} Felder
                            </span>
                          </div>
                          <div className="pt-1.5 space-y-0.5">
                            {m.fields.map((f, fIdx) => (
                              <div
                                key={fIdx}
                                className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300"
                              >
                                <span>{f.name}</span>
                                <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300">
                                  {f.type}
                                  {f.nullable ? '?' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generated PlantUML Code Viewer */}
                  <div className="space-y-1 flex-1 flex flex-col min-h-[140px]">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Generierter PlantUML-Code:</span>
                    </span>
                    <pre className="flex-1 p-2.5 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 overflow-auto whitespace-pre leading-relaxed">
                      {result.pumlCode}
                    </pre>
                  </div>

                  {/* Import Configuration Options */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-purple-500" />
                      <span>Import-Optionen</span>
                    </span>

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="target"
                          checked={importTarget === 'models-only'}
                          onChange={() => setImportTarget('models-only')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Nur im Datenmodell-Katalog speichern</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="target"
                          checked={importTarget === 'current-board'}
                          onChange={() => setImportTarget('current-board')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Auf aktuellem Board platzieren</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="target"
                          checked={importTarget === 'new-board'}
                          onChange={() => setImportTarget('new-board')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Neues Modell-Board erstellen</span>
                      </label>

                      {importTarget === 'new-board' && (
                        <input
                          type="text"
                          value={newBoardName}
                          onChange={(e) => setNewBoardName(e.target.value)}
                          placeholder="Name des neuen Boards (z.B. KI-Datenmodell)"
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 mt-1"
                        />
                      )}

                      <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200 dark:border-slate-800">
                        <input
                          type="checkbox"
                          checked={mergeModels}
                          onChange={(e) => setMergeModels(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span>Bestehende Modelle mit gleichen Namen aktualisieren (Merge)</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                onClick={() => result && executeImport(result)}
                disabled={!result || result.parsed.models.length === 0}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
                  result && result.parsed.models.length > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer active:scale-[0.99]'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {result && result.parsed.models.length > 0
                    ? `${result.parsed.models.length} Modell${
                        result.parsed.models.length === 1 ? '' : 'e'
                      } jetzt importieren`
                    : 'Kein Ergebnis zum Importieren'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
