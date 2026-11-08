import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  exportModelsToPlantUml,
  parsePlantUml,
  syncPlantUmlModelsWithProject,
  referencedTypeNames,
  type ParsedPlantUmlModel,
} from '@eventflow/core';
import {
  FileCode,
  Check,
  Copy,
  Download,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Layers,
  Database,
  Search,
  ExternalLink,
  Plus,
  GitFork,
  ArrowRight,
  Eye,
  Code,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface PlantUmlLiveEditorProps {
  onShowToast?: (msg: string) => void;
  onEditModel?: (modelId: string) => void;
  className?: string;
}

export const PlantUmlLiveEditor: React.FC<PlantUmlLiveEditorProps> = ({
  onShowToast,
  onEditModel,
  className = '',
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);

  // Initialize PUML code from current project models
  const [pumlCode, setPumlCode] = useState(() => exportModelsToPlantUml(project));
  const [autoSync, setAutoSync] = useState(false);
  const [deleteRemoved, setDeleteRemoved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appliedRecently, setAppliedRecently] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rightTab, setRightTab] = useState<'inspector' | 'preview'>('inspector');
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse PlantUML live on code changes
  const parseResult = useMemo(() => {
    try {
      return parsePlantUml(pumlCode);
    } catch (e) {
      return {
        models: [],
        endpoints: [],
        nodes: [],
        edges: [],
        warnings: [String(e)],
      };
    }
  }, [pumlCode]);

  // Count summary metrics
  const stats = useMemo(() => {
    const totalModels = parseResult.models.length;
    const abstractModels = parseResult.models.filter((m) => m.isAbstract).length;
    const totalFields = parseResult.models.reduce((acc, m) => acc + m.fields.length, 0);
    const inheritances = parseResult.models.filter((m) => m.extendsName).length;
    return { totalModels, abstractModels, totalFields, inheritances };
  }, [parseResult]);

  // Synchronize with project
  const handleApplyToProject = useCallback(
    (showToastNotification = true) => {
      try {
        let statsRes = { updatedCount: 0, createdCount: 0, deletedCount: 0 };
        store.update((draft) => {
          statsRes = syncPlantUmlModelsWithProject(draft, pumlCode, { deleteRemoved });
        });

        setAppliedRecently(true);
        setTimeout(() => setAppliedRecently(false), 2000);

        if (showToastNotification && onShowToast) {
          const parts: string[] = [];
          if (statsRes.createdCount > 0) parts.push(`${statsRes.createdCount} neu`);
          if (statsRes.updatedCount > 0) parts.push(`${statsRes.updatedCount} aktualisiert`);
          if (statsRes.deletedCount > 0) parts.push(`${statsRes.deletedCount} gelöscht`);
          const msg =
            parts.length > 0
              ? `✅ Modelle synchronisiert (${parts.join(', ')})`
              : '✅ Datenmodelle auf aktuellem Stand';
          onShowToast(msg);
        }
      } catch (err) {
        if (onShowToast) {
          onShowToast(`❌ Fehler beim Synchronisieren: ${err}`);
        }
      }
    },
    [store, pumlCode, deleteRemoved, onShowToast]
  );

  // Auto-sync debounced effect
  useEffect(() => {
    if (!autoSync) return;
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    autoSyncTimerRef.current = setTimeout(() => {
      handleApplyToProject(false);
    }, 600);

    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [pumlCode, autoSync, handleApplyToProject]);

  // Reset to project models
  const handleResetToProject = () => {
    const fresh = exportModelsToPlantUml(project);
    setPumlCode(fresh);
    if (onShowToast) onShowToast('🔄 PlantUML Code aus aktuellem Datenmodell neu geladen');
  };

  // Copy PlantUML code
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pumlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onShowToast) onShowToast('📋 PlantUML in die Zwischenablage kopiert');
    } catch (_) {
      // Fallback
    }
  };

  // Download .puml file
  const handleDownload = () => {
    const blob = new Blob([pumlCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_models.puml`;
    a.click();
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast('📥 PlantUML Datei heruntergeladen');
  };

  // Snippet insertion helper
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setPumlCode((prev) => prev + '\n' + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = pumlCode.substring(0, start);
    const after = pumlCode.substring(end);
    const newCode = before + snippet + after;
    setPumlCode(newCode);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Tab key and line navigation support in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      // Insert 2 spaces
      const updated = val.substring(0, start) + '  ' + val.substring(end);
      setPumlCode(updated);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Synchronize scroll between line numbers and textarea
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Update cursor position line and column
  const handleCursorActivity = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const textBefore = textarea.value.substring(0, textarea.selectionStart);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorPosition({ line, col });
  };

  // Filtered models for inspector
  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) return parseResult.models;
    const lower = searchTerm.toLowerCase();
    return parseResult.models.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        (m.extendsName && m.extendsName.toLowerCase().includes(lower)) ||
        m.fields.some(
          (f) =>
            f.name.toLowerCase().includes(lower) ||
            f.type.toLowerCase().includes(lower)
        )
    );
  }, [parseResult.models, searchTerm]);

  // Generate line numbers
  const totalLines = useMemo(() => {
    return Math.max(pumlCode.split('\n').length, 1);
  }, [pumlCode]);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0b0f19] ${className}`}>
      {/* Top Header / Action Toolbar */}
      <div className="h-14 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 select-none z-10">
        {/* Left: Title & Live Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                PlantUML Live-Editor
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  Modelle
                </span>
              </h2>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Quick diagnostics badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1.5 font-medium ${
                parseResult.warnings.length > 0
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  parseResult.warnings.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span>
                {stats.totalModels} {stats.totalModels === 1 ? 'Modell' : 'Modelle'}
                {stats.abstractModels > 0 && ` (${stats.abstractModels} abstract)`}
              </span>
            </span>

            {stats.inheritances > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <GitFork className="w-3 h-3 text-blue-500 rotate-180" />
                <span>{stats.inheritances} Vererbungen</span>
              </span>
            )}
          </div>
        </div>

        {/* Center: Quick Snippets */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => insertSnippet('\nclass NewModel {\n  +id: String\n  +name: String?\n}\n')}
            className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors"
            title="Standard Model-Klasse einfügen"
          >
            <Plus className="w-3 h-3 text-orange-500" />
            <span>+ Model</span>
          </button>
          <button
            onClick={() =>
              insertSnippet(
                '\nabstract class BaseEntity {\n  +id: String\n  +createdAt: DateTime?\n}\n'
              )
            }
            className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors"
            title="Abstrakte Basisklasse einfügen"
          >
            <Plus className="w-3 h-3 text-amber-500" />
            <span>+ Abstract</span>
          </button>
          <button
            onClick={() => insertSnippet('\nBaseEntity <|-- NewModel : extends\n')}
            className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors"
            title="Vererbungsbeziehung einfügen (<|--)"
          >
            <GitFork className="w-3 h-3 text-blue-500 rotate-180" />
            <span>+ extends</span>
          </button>
          <button
            onClick={() => insertSnippet('  +neuesFeld: String?\n')}
            className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors"
            title="Feld einfügen"
          >
            <span>+ Feld</span>
          </button>
        </div>

        {/* Right: Sync Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Auto-Sync Toggle */}
          <label
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 cursor-pointer text-xs select-none hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            title="Automatisches Synchronisieren bei jeder Eingabe"
          >
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => {
                setAutoSync(e.target.checked);
                if (e.target.checked) {
                  handleApplyToProject(false);
                  if (onShowToast) onShowToast('⚡ Auto-Sync aktiviert');
                }
              }}
              className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
            />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Auto-Sync</span>
            {autoSync && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </label>

          {/* Delete Removed Toggle */}
          <label
            className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
            title="Entfernt Modelle aus dem Projekt, die nicht mehr im PlantUML-Code vorhanden sind"
          >
            <input
              type="checkbox"
              checked={deleteRemoved}
              onChange={(e) => setDeleteRemoved(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 h-3 w-3"
            />
            <span>Gelöschte entfernen</span>
          </label>

          {/* Reset button */}
          <button
            onClick={handleResetToProject}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="PlantUML-Code aus aktuellem Projekt zurücksetzen"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="PlantUML Code kopieren"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title=".puml Datei herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Apply to Project Primary Button */}
          <button
            onClick={() => handleApplyToProject(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
              appliedRecently
                ? 'bg-emerald-600 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
            title="Änderungen sofort auf die Datenmodelle des Projekts anwenden"
          >
            {appliedRecently ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Angewendet!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auf Projekt anwenden</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Body: Editor (Left) & Inspector / Visual Preview (Right) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Pane: Code Editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f]">
          {/* Editor Sub-header */}
          <div className="h-8 px-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 select-none">
            <span className="flex items-center gap-1.5 font-mono">
              <Code className="w-3.5 h-3.5 text-orange-500" />
              <span>PlantUML Code (Klassendiagramm)</span>
            </span>
            <span>Tab: 2 Leerzeichen • Zeile {cursorPosition.line}, Spalte {cursorPosition.col}</span>
          </div>

          {/* Warnings Banner if any */}
          {parseResult.warnings.length > 0 && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <div className="flex-1 truncate font-mono text-[11px]">
                {parseResult.warnings.join(' | ')}
              </div>
            </div>
          )}

          {/* Editor Area with Line Numbers */}
          <div className="flex-1 flex relative overflow-hidden font-mono text-xs">
            {/* Line Numbers Gutter */}
            <div
              ref={lineNumbersRef}
              className="w-12 py-3 bg-slate-50 dark:bg-slate-950/60 border-r border-slate-200 dark:border-slate-800/80 text-right pr-2.5 text-slate-400 dark:text-slate-600 select-none overflow-hidden leading-5 font-mono"
            >
              {Array.from({ length: totalLines }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              ref={textareaRef}
              value={pumlCode}
              onChange={(e) => setPumlCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleCursorActivity}
              onClick={handleCursorActivity}
              onScroll={handleScroll}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="flex-1 h-full w-full py-3 px-3 bg-transparent text-slate-800 dark:text-slate-100 resize-none outline-none leading-5 overflow-auto selection:bg-orange-500/20 whitespace-pre"
              placeholder="@startuml\nclass Customer {\n  +id: String\n}\n@enduml"
            />
          </div>
        </div>

        {/* Right Pane: Inspector / Visual Preview */}
        <div className="w-full md:w-[420px] lg:w-[480px] flex flex-col bg-slate-50 dark:bg-[#0b0f19] overflow-hidden">
          {/* Right Header: Sub-tabs and Search */}
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 select-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setRightTab('inspector')}
                  className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                    rightTab === 'inspector'
                      ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Modell-Inspektor</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-mono">
                    {parseResult.models.length}
                  </span>
                </button>
                <button
                  onClick={() => setRightTab('preview')}
                  className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                    rightTab === 'preview'
                      ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>PlantText / Diagramm</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-500 font-mono">
                {stats.totalFields} Felder
              </span>
            </div>

            {rightTab === 'inspector' && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Modelle & Attribute filtern..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Right Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {rightTab === 'inspector' ? (
              filteredModels.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Database className="w-10 h-10 mb-2 opacity-30 text-orange-500" />
                  <p className="text-xs font-semibold">Keine Modelle gefunden</p>
                  <p className="text-[11px] mt-1 text-slate-500 max-w-xs">
                    Schreibe <code className="text-orange-600 dark:text-orange-400 font-mono">class Name {'{ ... }'}</code> im Editor links, um Modelle live zu erzeugen.
                  </p>
                </div>
              ) : (
                filteredModels.map((model) => (
                  <ModelInspectorCard
                    key={model.name}
                    model={model}
                    allModels={parseResult.models}
                    onJumpToModel={(targetName) => {
                      setSearchTerm(targetName);
                    }}
                  />
                ))
              )
            ) : (
              /* PlantText & Diagram Tab */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      <span>Diagramm online visualisieren</span>
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Du kannst den aktuellen Diagramm-Code direkt mit einem Klick in PlantText rendern und als Vektor-SVG oder PNG exportieren.
                  </p>
                  <a
                    href={`https://www.planttext.com/?text=${encodeURIComponent(pumlCode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>In PlantText.com öffnen</span>
                  </a>
                </div>

                {/* Direct SVG image preview from plantuml.com public render service */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span>Live-Hierarchie im Code</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                    {parseResult.models.map((m) => (
                      <div
                        key={m.name}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5 font-semibold">
                          {m.isAbstract && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              «abstract»
                            </span>
                          )}
                          <span>{m.name}</span>
                        </span>
                        {m.extendsName ? (
                          <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                            <span>extends</span>
                            <span className="font-bold">{m.extendsName}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Root</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ModelInspectorCardProps {
  model: ParsedPlantUmlModel;
  allModels: ParsedPlantUmlModel[];
  onJumpToModel: (name: string) => void;
}

const ModelInspectorCard: React.FC<ModelInspectorCardProps> = ({
  model,
  allModels,
  onJumpToModel,
}) => {
  const modelNames = useMemo(() => new Set(allModels.map((m) => m.name)), [allModels]);

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:border-orange-300 dark:hover:border-orange-800/60">
      {/* Card Header */}
      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            {model.isAbstract && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                «abstract»
              </span>
            )}
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {model.name}
            </span>
          </div>
        </div>

        {model.extendsName && (
          <button
            onClick={() => onJumpToModel(model.extendsName!)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            title={`Erbt von ${model.extendsName}`}
          >
            <GitFork className="w-3 h-3 rotate-180" />
            <span className="truncate max-w-[120px]">{model.extendsName}</span>
          </button>
        )}
      </div>

      {/* Card Fields List */}
      <div className="p-2 space-y-1">
        {model.fields.length === 0 ? (
          <div className="py-2 text-center text-[11px] text-slate-400 italic">
            Keine Felder definiert
          </div>
        ) : (
          model.fields.map((field, idx) => {
            const isSubModelRef = referencedTypeNames(field.type).some((name) =>
              modelNames.has(name)
            );

            return (
              <div
                key={idx}
                className="px-2 py-1 rounded-md text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] select-none">
                    +
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {field.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                      isSubModelRef
                        ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-semibold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {field.type}
                    {field.nullable && '?'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
