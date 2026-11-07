import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  exportBoardToPlantUml,
  exportModelsToPlantUml,
  exportProjectToPlantUml,
  parsePlantUml,
  importPlantUmlIntoProject,
} from '@eventflow/core';
import {
  X,
  Copy,
  Download,
  Upload,
  Check,
  FileCode,
  Layers,
  Database,
  FolderGit2,
  ExternalLink,
  FileUp,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialTab?: 'export' | 'import';
  onClose: () => void;
  onShowToast?: (msg: string) => void;
  onOpenFlowsView?: () => void;
}

type ExportMode = 'board' | 'models' | 'project';
type ImportTargetMode = 'current' | 'new' | 'modelsOnly';

const SAMPLE_FLOW_PUML = `@startuml
title EventFlow - Positionen Erfassen

rectangle "<b>Action</b>\\nPress Taetigkeit" as node_action #FEF9C3
rectangle "<b>API: POST</b>\\nTaetigkeiten / Positionen\\n..\\nParams:\\n• taetigkeitUuid: String\\n• unvollstaendig: bool?" as node_api #E0F2FE
rectangle "<b>Screen</b>\\nPositionen Maske\\n..\\nHotspots:\\n• Speichern Button (onTap)" as node_screen #FEF3C7
rectangle "<b>Model: PagedPositionenRESTModel</b>" as node_model #FFF7ED

node_action --> node_api : triggers
node_api --> node_model : response
node_screen --> node_api : submit
@enduml`;

const SAMPLE_MODELS_PUML = `@startuml
title Auftragsmodelle (Klassendiagramm)

class "TaetigkeitPositionRESTModel" as node_m1 #FFF7ED {
  +uuid: String
  +nummer: String?
  +name: String?
  +sortIndex: int
  +abgeschlossen: bool
  +preis: double?
}

class "PagedPositionenRESTModel" as node_m2 #FFF7ED {
  +positionen: List<TaetigkeitPositionRESTModel>
  +currentPage: int
  +requestedEntriesPerPage: int
}

node_m2 "1" *-- "*" node_m1 : positionen
@enduml`;

export const PlantUmlExportModal: React.FC<Props> = ({
  isOpen,
  initialTab = 'export',
  onClose,
  onShowToast,
  onOpenFlowsView,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const activeBoard = project.boards.find((b) => b.id === activeBoardId) ?? project.boards[0];

  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Export states
  const [exportMode, setExportMode] = useState<ExportMode>('board');
  const [copied, setCopied] = useState(false);

  // Import states
  const [pumlInput, setPumlInput] = useState('');
  const [importTarget, setImportTarget] = useState<ImportTargetMode>('current');
  const [newBoardName, setNewBoardName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live parsed analysis
  const parseResult = useMemo(() => {
    if (!pumlInput.trim()) return null;
    try {
      return parsePlantUml(pumlInput);
    } catch (e) {
      console.error('Error parsing PlantUML:', e);
      return null;
    }
  }, [pumlInput]);

  // Set default new board name when title is detected
  useEffect(() => {
    if (parseResult?.title && !newBoardName) {
      setNewBoardName(parseResult.title);
    }
  }, [parseResult?.title, newBoardName]);

  if (!isOpen) return null;

  // Generate export code
  let pumlCode = '';
  let defaultFileName = '';

  if (exportMode === 'board') {
    pumlCode = activeBoard ? exportBoardToPlantUml(project, activeBoard) : '';
    defaultFileName = `${(activeBoard?.name || 'flow').toLowerCase().replace(/\s+/g, '_')}.puml`;
  } else if (exportMode === 'models') {
    pumlCode = exportModelsToPlantUml(project);
    defaultFileName = `${project.name.toLowerCase().replace(/\s+/g, '_')}_models.puml`;
  } else {
    pumlCode = exportProjectToPlantUml(project);
    defaultFileName = `${project.name.toLowerCase().replace(/\s+/g, '_')}_complete.puml`;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(pumlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([pumlCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPlantText = () => {
    window.open('https://www.planttext.com/', '_blank');
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPumlInput(text);
        if (onShowToast) onShowToast(`Datei "${file.name}" geladen`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Execute import
  const handleExecuteImport = () => {
    if (!parseResult) return;

    let targetBoardOpt: string | 'new' | undefined = undefined;
    let addNodes = true;

    if (importTarget === 'new') {
      targetBoardOpt = 'new';
    } else if (importTarget === 'current') {
      targetBoardOpt = activeBoard?.id;
    } else if (importTarget === 'modelsOnly') {
      addNodes = false;
    }

    let stats: any = null;

    store.update((draft) => {
      stats = importPlantUmlIntoProject(draft, parseResult, {
        targetBoardId: targetBoardOpt,
        newBoardName: newBoardName.trim() || parseResult.title || 'Importierter Flow',
        mergeModels: true,
        mergeEndpoints: true,
        addNodesToBoard: addNodes,
      });
    });

    if (stats?.boardId) {
      store.setActiveBoard(stats.boardId);
      if (addNodes && onOpenFlowsView) {
        onOpenFlowsView();
      }
    }

    const msg = `PlantUML Import: ${stats?.createdModels?.length || 0} Modelle, ${stats?.createdEndpoints?.length || 0} Endpoints, ${stats?.createdNodesCount || 0} Flow-Elemente übernommen!`;
    if (onShowToast) onShowToast(msg);

    onClose();
  };

  const totalDetectedElements =
    (parseResult?.models?.length || 0) +
    (parseResult?.endpoints?.length || 0) +
    (parseResult?.nodes?.length || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  PlantUML
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                  .puml
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeTab === 'export'
                  ? 'Generiere sofort einsatzbereiten PlantUML-Code für Flows, Architektur und Datenmodelle.'
                  : 'Importiere bestehende PlantUML-Klassendiagramme oder Architektur-Flows nahtlos in dein Projekt.'}
              </p>
            </div>
          </div>

          {/* Tab Switcher: Export vs Import */}
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-slate-200/80 dark:bg-slate-950 rounded-xl border border-slate-300/80 dark:border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('export')}
                className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'export'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportieren</span>
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'import'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importieren</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* EXPORT TAB                                                         */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'export' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mode Selector Tabs */}
            <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setExportMode('board')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    exportMode === 'board'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Aktueller Flow ({activeBoard?.name || 'Flow'})</span>
                </button>

                <button
                  onClick={() => setExportMode('models')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    exportMode === 'models'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Datenmodelle (Klassendiagramm)</span>
                </button>

                <button
                  onClick={() => setExportMode('project')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    exportMode === 'project'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>Gesamtes Projekt ({project.boards.length} Flows)</span>
                </button>
              </div>

              <button
                onClick={handleOpenPlantText}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1 hover:underline"
                title="PlantText Online-Editor in neuem Tab öffnen"
              >
                <span>PlantText Editor</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Code View */}
            <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 overflow-auto font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              <pre className="select-text whitespace-pre-wrap">{pumlCode}</pre>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {pumlCode.split('\n').length} Zeilen generiert
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Kopiert!' : 'In Zwischenablage'}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Als .puml herunterladen
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* IMPORT TAB                                                         */
          /* ------------------------------------------------------------------ */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Import Actions Bar */}
            <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".puml,.plantuml,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 shadow-sm transition-colors"
                >
                  <FileUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Datei hochladen (.puml)</span>
                </button>

                <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Beispiele:
                </span>
                <button
                  onClick={() => setPumlInput(SAMPLE_MODELS_PUML)}
                  className="px-2.5 py-1 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs transition-colors border border-slate-200 dark:border-slate-700"
                >
                  Datenmodelle
                </button>
                <button
                  onClick={() => setPumlInput(SAMPLE_FLOW_PUML)}
                  className="px-2.5 py-1 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs transition-colors border border-slate-200 dark:border-slate-700"
                >
                  Flow-Architektur
                </button>
              </div>

              {pumlInput && (
                <button
                  onClick={() => setPumlInput('')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Textfeld leeren
                </button>
              )}
            </div>

            {/* Main Area: Split into Textarea (left) and Live Analysis / Options (right) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Textarea */}
              <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span>PlantUML Quellcode hier einfügen:</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Unterstützt Klassen, Attribute, Rectangles, Endpoints, Notes & Pfeile
                  </span>
                </label>
                <textarea
                  value={pumlInput}
                  onChange={(e) => setPumlInput(e.target.value)}
                  placeholder={`@startuml\nclass Customer {\n  +id: int\n  +name: String\n}\n@enduml`}
                  className="flex-1 w-full p-3 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl resize-none focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-200 leading-relaxed shadow-inner"
                  spellCheck={false}
                />
              </div>

              {/* Live Detection & Target Settings Panel */}
              <div className="w-full md:w-96 flex flex-col p-4 bg-slate-100/50 dark:bg-slate-900/50 overflow-y-auto space-y-4">
                {/* Live Detection Summary Card */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Live-Erkennung</span>
                    </span>
                    {parseResult && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                        {totalDetectedElements} Elemente erkannt
                      </span>
                    )}
                  </div>

                  {!pumlInput.trim() ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                      <FileCode className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                      <p>
                        Füge PlantUML-Code ein oder wähle eine Datei aus, um die Erkennung zu starten.
                      </p>
                    </div>
                  ) : totalDetectedElements === 0 ? (
                    <div className="py-4 text-center text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 justify-center">
                      <AlertCircle className="w-4 h-4" />
                      <span>Keine bekannten Elemente (Klassen oder Rectangles) erkannt.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      {parseResult?.title && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Titel: <strong className="text-slate-800 dark:text-slate-200">{parseResult.title}</strong>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60">
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold block">
                            Datenmodelle
                          </span>
                          <span className="text-base font-bold text-orange-700 dark:text-orange-300">
                            {parseResult?.models.length || 0}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block">
                            API-Endpoints
                          </span>
                          <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                            {parseResult?.endpoints.length || 0}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                            Flow-Elemente
                          </span>
                          <span className="text-base font-bold text-amber-700 dark:text-amber-300">
                            {parseResult?.nodes.length || 0}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block">
                            Verbindungen
                          </span>
                          <span className="text-base font-bold text-purple-700 dark:text-purple-300">
                            {parseResult?.edges.length || 0}
                          </span>
                        </div>
                      </div>

                      {/* Detail preview */}
                      {parseResult && parseResult.models.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Erkannte Modelle:
                          </span>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {parseResult.models.map((m) => (
                              <div
                                key={m.name}
                                className="text-[11px] flex items-center justify-between text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded"
                              >
                                <span className="font-medium truncate">{m.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {m.fields.length} Felder
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Import Target Options */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Import-Ziel & Platzierung
                  </span>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importTarget"
                        checked={importTarget === 'current'}
                        onChange={() => setImportTarget('current')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          In aktuellen Flow einfügen
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Fügt Elemente zu Board &quot;{activeBoard?.name || 'Flow'}&quot; hinzu.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importTarget"
                        checked={importTarget === 'new'}
                        onChange={() => setImportTarget('new')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Als neues Flow-Board anlegen
                        </span>
                        {importTarget === 'new' && (
                          <input
                            type="text"
                            placeholder="Name des neuen Flows..."
                            value={newBoardName}
                            onChange={(e) => setNewBoardName(e.target.value)}
                            className="mt-1 w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-200"
                          />
                        )}
                      </div>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importTarget"
                        checked={importTarget === 'modelsOnly'}
                        onChange={() => setImportTarget('modelsOnly')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Nur Datenmodelle ins Projekt
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Erstellt die Datenmodelle, platziert aber keine Knoten auf dem Flow-Canvas.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Import Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {totalDetectedElements > 0
                  ? `Bereit zum Import: ${totalDetectedElements} Elemente erkannt`
                  : 'Füge PlantUML-Code ein, um zu importieren'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={totalDetectedElements === 0}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
                    totalDetectedElements > 0
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Jetzt importieren ({totalDetectedElements})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
