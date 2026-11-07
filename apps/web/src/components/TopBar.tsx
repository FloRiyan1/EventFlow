import React, { useRef, useState, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  createModel,
  createEndpoint,
  projectToZip,
  uid,
} from '@eventflow/core';
import {
  Undo,
  Redo,
  Save,
  Smartphone,
  Globe,
  Database,
  MousePointerClick,
  FileText,
  Workflow,
  Sun,
  Moon,
  Edit2,
  FileCode,
  Users,
  Coffee,
} from 'lucide-react';
import { useTheme } from '../themeContext';
import { useCollaboration } from '../collaborationContext';

interface Props {
  activeView?: 'flows' | 'models';
  onSelectView?: (view: 'flows' | 'models') => void;
  onOpenPlantUmlExport?: () => void;
  onOpenPlantUmlModal?: (tab?: 'export' | 'import') => void;
  onOpenJavaModal?: (tab?: 'export' | 'import') => void;
  onEditModel: (modelId: string) => void;
  onEditEndpoint: (endpointId: string) => void;
  onPasteFromClipboard: () => void;
}

export const TopBar: React.FC<Props> = ({
  activeView = 'flows',
  onSelectView,
  onOpenPlantUmlExport,
  onOpenPlantUmlModal,
  onOpenJavaModal,
  onEditModel,
  onEditEndpoint,
  onPasteFromClipboard,
}) => {
  const store = useEditorStore();
  const { status, setIsModalOpen, jumpToPeer } = useCollaboration();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const activeBoard = project.boards.find((b) => b.id === activeBoardId) ?? project.boards[0];

  // Active board name inline editing
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState('');

  useEffect(() => {
    setBoardNameDraft(activeBoard?.name || 'Board');
  }, [activeBoard?.name]);

  const handleSaveBoardName = () => {
    const trimmed = boardNameDraft.trim();
    if (trimmed && activeBoard) {
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === activeBoard.id);
        if (b) b.name = trimmed;
      });
    }
    setIsEditingBoardName(false);
  };

  const handleAddScreen = () => {
    onPasteFromClipboard();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const assetId = uid('a_');
      store.update((draft) => {
        draft.assets[assetId] = {
          id: assetId,
          mime: file.type || 'image/png',
          width: 320,
          height: 600,
          dataUrl,
        };
        const b = draft.boards.find((item) => item.id === draft.boards[0].id);
        if (!b) return;
        const lastScreen = [...b.nodes].reverse().find((n) => n.kind === 'screen');
        const x = lastScreen ? lastScreen.position.x + 320 : 100;
        const y = lastScreen ? lastScreen.position.y : 80;
        b.nodes.push({
          id: uid('n_'),
          kind: 'screen',
          title: file.name.replace(/\.[^/.]+$/, ''),
          assetId,
          width: 260,
          hotspots: [],
          position: { x, y },
        });
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddEndpoint = () => {
    const newEp = createEndpoint('POST', `Taetigkeiten / neu_${project.endpoints.length + 1}`);
    const nodeId = uid('n_');
    store.update((draft) => {
      draft.endpoints.push(newEp);
      const b = draft.boards.find((item) => item.id === draft.boards[0].id);
      if (!b) return;
      b.nodes.push({
        id: nodeId,
        kind: 'endpoint',
        endpointId: newEp.id,
        position: { x: 400 + Math.random() * 100, y: 350 + Math.random() * 100 },
      });
    });
    onEditEndpoint(newEp.id);
  };

  const handleAddModel = () => {
    const newModel = createModel(`NeuesModel${project.models.length + 1}`);
    const nodeId = uid('n_');
    store.update((draft) => {
      draft.models.push(newModel);
      const b = draft.boards.find((item) => item.id === draft.boards[0].id);
      if (!b) return;
      b.nodes.push({
        id: nodeId,
        kind: 'model',
        modelId: newModel.id,
        position: { x: 400 + Math.random() * 100, y: 650 + Math.random() * 100 },
      });
    });
    onEditModel(newModel.id);
  };

  const handleAddUserAction = () => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === draft.boards[0].id);
      if (!b) return;
      b.nodes.push({
        id: uid('n_'),
        kind: 'userAction',
        label: 'User Aktion',
        position: { x: 100 + Math.random() * 100, y: 150 + Math.random() * 50 },
      });
    });
  };

  const handleAddNote = () => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === draft.boards[0].id);
      if (!b) return;
      b.nodes.push({
        id: uid('n_'),
        kind: 'note',
        text: 'Neue Notiz',
        position: { x: 500, y: 400 },
      });
    });
  };

  const handleSaveProject = async () => {
    try {
      const zipData = await projectToZip(project);
      const blob = new Blob([zipData as unknown as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}.eventflow`;
      a.click();
      URL.revokeObjectURL(url);
      store.markSaved();
    } catch (e) {
      alert('Fehler beim Speichern der Projektdatei: ' + e);
    }
  };

  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-20 select-none transition-colors">
      {/* Hidden image picker */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-amber-500 flex items-center justify-center shadow-md">
            <Workflow className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
              EventFlow
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                v0.1
              </span>
            </h1>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Project Name editable */}
        <input
          type="text"
          value={project.name}
          onChange={(e) => {
            const val = e.target.value;
            store.update((draft) => {
              draft.name = val;
            });
          }}
          className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-950 px-2 py-1 rounded text-xs font-semibold text-slate-800 dark:text-slate-200 border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:outline-none transition-colors"
          title="Projektname ändern"
        />

        <span className="text-slate-400 dark:text-slate-600 text-xs">/</span>

        {/* Active Board Name editable */}
        {isEditingBoardName ? (
          <input
            type="text"
            value={boardNameDraft}
            onChange={(e) => setBoardNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveBoardName();
              if (e.key === 'Escape') {
                setBoardNameDraft(activeBoard?.name || 'Board');
                setIsEditingBoardName(false);
              }
            }}
            onBlur={handleSaveBoardName}
            autoFocus
            className="bg-white dark:bg-slate-950 px-2 py-0.5 rounded text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-400 ring-1 ring-amber-400 outline-none transition-colors"
          />
        ) : (
          <div className="flex items-center gap-1 group/bname">
            <span
              onClick={() => {
                setBoardNameDraft(activeBoard?.name || 'Board');
                setIsEditingBoardName(true);
              }}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-1.5 py-0.5 rounded transition-colors"
              title="Klicken zum Umbenennen des aktuellen Flows"
            >
              {activeBoard?.name || 'Board'}
            </span>
            <button
              onClick={() => {
                setBoardNameDraft(activeBoard?.name || 'Board');
                setIsEditingBoardName(!isEditingBoardName);
              }}
              title="Aktuellen Flow umbenennen"
              className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded opacity-0 group-hover/bname:opacity-100 transition-opacity"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Center: View Switcher & Canvas Add Buttons */}
      <div className="flex items-center gap-2.5">
        {/* View Switcher: Flows vs Datenmodelle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
          <button
            onClick={() => onSelectView?.('flows')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'flows'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Zu den Flow-Boards wechseln"
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Flows</span>
          </button>
          <button
            onClick={() => onSelectView?.('models')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'models'
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Zur reinen Datenmodell-Ansicht mit allen Untermodellen wechseln"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Datenmodelle</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60 font-mono">
              {project.models.length}
            </span>
          </button>
        </div>

        {/* Middle: Canvas Add Buttons (shown when in flows view) */}
        {activeView === 'flows' && (
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={handleAddScreen}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/80 shadow-none hover:shadow-sm flex items-center gap-1.5 transition-all"
              title="Figma Screen einfügen (oder einfach Strg+V auf der Zeichenfläche!)"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>+ Screen</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">(Strg+V)</span>
            </button>

            <button
              onClick={handleAddEndpoint}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/80 shadow-none hover:shadow-sm flex items-center gap-1.5 transition-all"
              title="API Endpoint Block hinzufügen"
            >
              <Globe className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>+ API</span>
            </button>

            <button
              onClick={handleAddModel}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/80 shadow-none hover:shadow-sm flex items-center gap-1.5 transition-all"
              title="Model Block hinzufügen"
            >
              <Database className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
              <span>+ Model</span>
            </button>

            <button
              onClick={handleAddUserAction}
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/80 shadow-none hover:shadow-sm flex items-center gap-1 transition-all"
              title="User Action Element hinzufügen"
            >
              <MousePointerClick className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400" />
              <span>+ Action</span>
            </button>

            <button
              onClick={handleAddNote}
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/80 shadow-none hover:shadow-sm flex items-center gap-1 transition-all"
              title="Notiz hinzufügen"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>+ Notiz</span>
            </button>
          </div>
        )}
      </div>

      {/* Right: Actions, Undo/Redo, Persistence & Theme Toggle */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => store.undo()}
            disabled={!canUndo}
            className={`p-1.5 rounded text-xs transition-colors ${
              canUndo
                ? 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white shadow-none hover:shadow-sm'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
            title="Rückgängig (Strg+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => store.redo()}
            disabled={!canRedo}
            className={`p-1.5 rounded text-xs transition-colors ${
              canRedo
                ? 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white shadow-none hover:shadow-sm'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
            title="Wiederholen (Strg+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 flex items-center justify-center"
          title={theme === 'dark' ? 'Zu Whitemode wechseln' : 'Zu Darkmode wechseln'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-90 duration-200" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 animate-in spin-in-90 duration-200" />
          )}
        </button>


        {/* PlantUML Export & Import */}
        <div className="flex items-center rounded-lg border border-purple-200 dark:border-purple-500/30 overflow-hidden shadow-sm">
          <button
            onClick={() => (onOpenPlantUmlModal ? onOpenPlantUmlModal('export') : onOpenPlantUmlExport?.())}
            className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-600/20 hover:bg-purple-100 dark:hover:bg-purple-600/30 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border-r border-purple-200 dark:border-purple-500/30"
            title="Als PlantUML Diagramm exportieren"
          >
            <FileCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>PlantUML</span>
          </button>
          <button
            onClick={() => (onOpenPlantUmlModal ? onOpenPlantUmlModal('import') : onOpenPlantUmlExport?.())}
            className="px-2 py-1.5 bg-purple-50 dark:bg-purple-600/20 hover:bg-purple-100 dark:hover:bg-purple-600/30 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1 transition-colors"
            title="PlantUML Importieren (Code einfügen oder .puml Datei laden)"
          >
            <span>Import</span>
          </button>
        </div>

        {/* Java Records & POJOs Export & Import */}
        {onOpenJavaModal && (
          <div className="flex items-center rounded-lg border border-amber-300 dark:border-amber-700/60 overflow-hidden shadow-sm">
            <button
              onClick={() => onOpenJavaModal('export')}
              className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border-r border-amber-300 dark:border-amber-700/60"
              title="Als Java Records oder POJOs exportieren"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Java</span>
            </button>
            <button
              onClick={() => onOpenJavaModal('import')}
              className="px-2 py-1.5 bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Java Code importieren (Records & Klassen)"
            >
              <span>Import</span>
            </button>
          </div>
        )}

        {/* Live Multiplayer Collaboration */}
        {status.roomName ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 rounded-lg text-xs font-semibold shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            title={`Verbunden mit Raum: ${status.roomName}. Klicken für Details & Share-Link.`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Live ({status.peers.length + 1})</span>
            {/* Peer Avatars */}
            <div className="flex -space-x-1.5 ml-0.5">
              <div
                className="w-4 h-4 rounded-full ring-1 ring-white dark:ring-gray-900 flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                style={{ backgroundColor: status.self.color }}
                title={`${status.self.name} (Du)`}
              >
                {status.self.name.slice(0, 1).toUpperCase()}
              </div>
              {status.peers.slice(0, 4).map((p) => (
                <div
                  key={p.clientId}
                  onClick={(e) => {
                    e.stopPropagation();
                    jumpToPeer(p.clientId);
                  }}
                  className="w-4 h-4 rounded-full ring-1 ring-white dark:ring-gray-900 flex items-center justify-center text-[9px] font-bold text-white shadow-xs cursor-pointer hover:scale-125 transition-transform"
                  style={{ backgroundColor: p.user.color }}
                  title={`Zu ${p.user.name} springen`}
                >
                  {p.user.name.slice(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
          </button>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            title="Echtzeit-Kollaboration starten (Multiplayer per Raum-Link)"
          >
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Live teilen</span>
          </button>
        )}

        <button
          onClick={handleSaveProject}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
          title="Projekt speichern (*.eventflow ZIP)"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Speichern</span>
        </button>
      </div>
    </header>
  );
};
