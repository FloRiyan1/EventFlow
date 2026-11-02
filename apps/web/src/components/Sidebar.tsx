import React, { useState } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  createBoard,
  createModel,
  createEndpoint,
  deleteModel,
  deleteEndpoint,
  deleteBoard,
  modelUsages,
  endpointUsages,
  getModelHierarchyInfo,
  insertModelWithSubModels,
  uid,
} from '@eventflow/core';
import type { Model, Endpoint } from '@eventflow/core';
import {
  Layers,
  Database,
  Globe,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Search,
  GripVertical,
  AlertTriangle,
  Workflow,
  ListTree,
  ExternalLink,
  Network,
} from 'lucide-react';

interface Props {
  onEditModel: (modelId: string) => void;
  onEditEndpoint: (endpointId: string) => void;
  onOpenDataModelsView?: () => void;
}

export const Sidebar: React.FC<Props> = ({
  onEditModel,
  onEditEndpoint,
  onOpenDataModelsView,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);

  const [activeTab, setActiveTab] = useState<'flows' | 'models' | 'apis'>('flows');
  const [modelSearch, setModelSearch] = useState('');

  // Flow renaming state
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [boardNameDraft, setBoardNameDraft] = useState('');

  // Confirmation modal state when deleting models, endpoints, or flows that are currently in use
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'model' | 'endpoint' | 'board';
    id: string;
    name: string;
    usages: {
      boards: string[];
      referencingModels?: string[];
      referencingEndpoints?: string[];
      nodeCount?: number;
    };
  } | null>(null);

  const activeBoard = project.boards.find((b) => b.id === activeBoardId) ?? project.boards[0];

  const handleStartRenameBoard = (boardId: string, currentName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingBoardId(boardId);
    setBoardNameDraft(currentName);
  };

  const handleSaveRenameBoard = (boardId: string) => {
    const trimmed = boardNameDraft.trim();
    if (trimmed) {
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === boardId);
        if (b) b.name = trimmed;
      });
    }
    setEditingBoardId(null);
  };

  const handleDeleteBoard = (board: { id: string; name: string; nodes: unknown[] }) => {
    if (project.boards.length <= 1) return;

    // Check if other boards reference this board via flowRef
    const referencingBoards = project.boards
      .filter((b) => b.id !== board.id && b.nodes.some((n) => n.kind === 'flowRef' && n.targetBoardId === board.id))
      .map((b) => b.name);

    if (board.nodes.length > 0 || referencingBoards.length > 0) {
      setDeleteConfirmation({
        type: 'board',
        id: board.id,
        name: board.name,
        usages: {
          boards: referencingBoards,
          nodeCount: board.nodes.length,
        },
      });
    } else {
      store.update((draft) => {
        deleteBoard(draft, board.id);
      });
    }
  };

  const handleAddBoard = () => {
    const newBoard = createBoard(`Flow ${project.boards.length + 1}`);
    store.update((draft) => {
      draft.boards.push(newBoard);
    });
    store.setActiveBoard(newBoard.id);
  };

  const handleAddModel = () => {
    const newModel = createModel(`NeuesModel${project.models.length + 1}`);
    store.update((draft) => {
      draft.models.push(newModel);
    });
    onEditModel(newModel.id);
  };

  const handleAddEndpoint = () => {
    const newEp = createEndpoint('GET', `/api/v1/neu_${project.endpoints.length + 1}`);
    store.update((draft) => {
      draft.endpoints.push(newEp);
    });
    onEditEndpoint(newEp.id);
  };

  // Delete model: Ask confirmation ONLY if used, otherwise delete directly
  const handleDeleteModel = (model: Model) => {
    const usages = modelUsages(project, model.id);
    const isUsed =
      usages.boards.length > 0 ||
      usages.models.length > 0 ||
      usages.endpoints.length > 0;

    if (isUsed) {
      setDeleteConfirmation({
        type: 'model',
        id: model.id,
        name: model.name,
        usages: {
          boards: usages.boards.map((b) => b.name),
          referencingModels: usages.models.map((m) => m.name),
          referencingEndpoints: usages.endpoints.map((e) => `${e.method} ${e.path}`),
        },
      });
    } else {
      // Not in use: delete directly without asking
      store.update((draft) => {
        deleteModel(draft, model.id);
      });
    }
  };

  // Delete endpoint: Ask confirmation ONLY if used on boards, otherwise delete directly
  const handleDeleteEndpoint = (endpoint: Endpoint) => {
    const usages = endpointUsages(project, endpoint.id);
    const isUsed = usages.boards.length > 0;

    if (isUsed) {
      setDeleteConfirmation({
        type: 'endpoint',
        id: endpoint.id,
        name: `${endpoint.method} ${endpoint.path}`,
        usages: {
          boards: usages.boards.map((b) => b.name),
        },
      });
    } else {
      // Not in use: delete directly without asking
      store.update((draft) => {
        deleteEndpoint(draft, endpoint.id);
      });
    }
  };

  // Confirm delete handler
  const confirmDelete = () => {
    if (!deleteConfirmation) return;

    store.update((draft) => {
      if (deleteConfirmation.type === 'model') {
        deleteModel(draft, deleteConfirmation.id);
      } else if (deleteConfirmation.type === 'endpoint') {
        deleteEndpoint(draft, deleteConfirmation.id);
      } else if (deleteConfirmation.type === 'board') {
        deleteBoard(draft, deleteConfirmation.id);
      }
    });

    setDeleteConfirmation(null);
  };

  // Place an existing model onto the current board (optionally with all submodels)
  const placeModelOnBoard = (model: Model, includeSubModels = false) => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId) ?? draft.boards[0];
      if (!b) return;
      const x = 300 + Math.random() * 120;
      const y = 600 + Math.random() * 60;

      if (includeSubModels) {
        insertModelWithSubModels(b, draft, model.id, {
          basePosition: { x, y },
        });
      } else {
        b.nodes.push({
          id: uid('n_'),
          kind: 'model',
          modelId: model.id,
          position: { x, y },
        });
      }
    });
  };

  // Place an existing endpoint onto the current board
  const placeEndpointOnBoard = (endpoint: Endpoint) => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId) ?? draft.boards[0];
      if (!b) return;
      const x = 300 + Math.random() * 200;
      const y = 350 + Math.random() * 100;
      b.nodes.push({
        id: uid('n_'),
        kind: 'endpoint',
        endpointId: endpoint.id,
        position: { x, y },
      });
    });
  };

  // Place another flow as an entry point (flowRef) onto the current board
  const placeFlowRefOnBoard = (targetBoard: { id: string; name: string }) => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId) ?? draft.boards[0];
      if (!b) return;
      const x = 150 + Math.random() * 100;
      const y = 150 + Math.random() * 100;
      b.nodes.push({
        id: uid('n_'),
        kind: 'flowRef',
        targetBoardId: targetBoard.id,
        label: targetBoard.name,
        position: { x, y },
      });
    });
  };

  const filteredModels = project.models.filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-10 select-none transition-colors">
      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 p-2 gap-1 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('flows')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'flows'
              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Flows
        </button>
        <button
          onClick={() => setActiveTab('models')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'models'
              ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> Models
        </button>
        <button
          onClick={() => setActiveTab('apis')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'apis'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> APIs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TAB 1: FLOWS */}
        {activeTab === 'flows' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Flow Boards ({project.boards.length})
              </span>
              <button
                onClick={handleAddBoard}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition-colors"
                title="Neuen Flow anlegen"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2 rounded border border-slate-200 dark:border-slate-800">
              💡 Tipp: Klicke auf einen Flow zum Wechseln, oder ziehe einen anderen Flow per <strong>Drag & Drop</strong> als Einstiegspunkt auf das Canvas!
            </div>

            <div className="space-y-1.5">
              {project.boards.map((b) => {
                const isActive = b.id === activeBoardId;
                return (
                  <div
                    key={b.id}
                    draggable={!isActive}
                    onDragStart={(e) => {
                      if (isActive) return;
                      e.dataTransfer.setData(
                        'application/eventflow',
                        JSON.stringify({ type: 'flowRef', id: b.id, name: b.name })
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => store.setActiveBoard(b.id)}
                    className={`p-2.5 rounded-lg flex flex-col gap-1.5 transition-all border group ${
                      isActive
                        ? 'bg-amber-50 dark:bg-slate-800 border-amber-400 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 font-semibold shadow-sm cursor-default'
                        : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 hover:border-purple-400 dark:hover:border-purple-500/50 cursor-grab active:cursor-grabbing shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 truncate text-xs flex-1 min-w-0">
                        {!isActive ? (
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 shrink-0" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                        )}

                        {editingBoardId === b.id ? (
                          <input
                            type="text"
                            value={boardNameDraft}
                            onChange={(e) => setBoardNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameBoard(b.id);
                              if (e.key === 'Escape') setEditingBoardId(null);
                            }}
                            onBlur={() => handleSaveRenameBoard(b.id)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-0.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded text-xs font-semibold w-full outline-none ring-1 ring-amber-400 border border-slate-300 dark:border-slate-700 shadow-sm"
                          />
                        ) : (
                          <span
                            onDoubleClick={(e) => handleStartRenameBoard(b.id, b.name, e)}
                            className="truncate cursor-pointer"
                            title="Doppelklick zum Umbenennen"
                          >
                            {b.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {b.nodes.length} Nodes
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleStartRenameBoard(b.id, b.name, e)}
                          className="text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Flow umbenennen"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {project.boards.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBoard(b);
                            }}
                            className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Flow löschen"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {!isActive && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/60 text-[11px]">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">Anderer Flow</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            placeFlowRefOnBoard(b);
                          }}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium flex items-center gap-1 hover:underline text-[10px]"
                          title="Diesen Flow als Einstiegspunkt auf dem aktuellen Canvas platzieren"
                        >
                          + Als Einstiegspunkt
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: MODELS */}
        {activeTab === 'models' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Model-Registry ({project.models.length})
              </span>
              <button
                onClick={handleAddModel}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-orange-600 dark:text-orange-400 rounded transition-colors"
                title="Neues Model anlegen"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2 rounded border border-slate-200 dark:border-slate-800">
              💡 Tipp: Ziehe ein Model per <strong>Drag & Drop</strong> direkt auf den Canvas.
            </div>

            {onOpenDataModelsView && (
              <button
                type="button"
                onClick={onOpenDataModelsView}
                className="w-full px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors shadow-sm"
                title="Vollständige Datenmodell-Ansicht mit allen Untermodellen öffnen"
              >
                <div className="flex items-center gap-1.5">
                  <ListTree className="w-3.5 h-3.5 text-orange-500" />
                  <span>In Datenmodell-Ansicht öffnen</span>
                </div>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </button>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Model suchen..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              {filteredModels.map((m) => {
                const hierarchy = getModelHierarchyInfo(project, m.id);
                const hasSubModels = hierarchy.subModels.length > 0;

                return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/eventflow',
                        JSON.stringify({ type: 'model', id: m.id, name: m.name })
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="p-2.5 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg text-xs flex flex-col gap-1.5 group hover:border-orange-400 dark:hover:border-orange-500/50 cursor-grab active:cursor-grabbing transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-orange-500 dark:group-hover:text-orange-400 shrink-0" />
                      <span className="font-semibold text-orange-600 dark:text-orange-300 truncate flex-1" title={m.name}>
                        {m.name}
                      </span>
                      {hasSubModels && (
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(
                              'application/eventflow',
                              JSON.stringify({ type: 'model', id: m.id, name: m.name, includeSubModels: true })
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className="text-[9px] px-1 py-0.2 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-semibold border border-orange-200 dark:border-orange-800/60 cursor-grab hover:bg-orange-200"
                          title="Ziehen, um dieses Model inkl. aller Untermodelle auf den Canvas zu ziehen"
                        >
                          +Sub
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onEditModel(m.id)}
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Model bearbeiten"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(m)}
                          className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Model löschen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 gap-1">
                      <span>{m.fields.length} Felder</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => placeModelOnBoard(m, false)}
                          className="text-orange-600 dark:text-orange-400 hover:text-orange-500 font-medium hover:underline text-[10px]"
                          title="Nur dieses Model auf dem Board platzieren"
                        >
                          + Board
                        </button>
                        {hasSubModels && (
                          <button
                            type="button"
                            onClick={() => placeModelOnBoard(m, true)}
                            className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60 font-semibold border border-orange-300 dark:border-orange-800/60 flex items-center gap-1 text-[10px] transition-colors"
                            title={`"${m.name}" inklusive aller ${hierarchy.subModels.length} Untermodelle auf dem Canvas platzieren`}
                          >
                            <Network className="w-2.5 h-2.5" />
                            <span>+ Inkl. Untermodelle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: APIS */}
        {activeTab === 'apis' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                API-Registry ({project.endpoints.length})
              </span>
              <button
                onClick={handleAddEndpoint}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 rounded transition-colors"
                title="Neuen Endpoint anlegen"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2 rounded border border-slate-200 dark:border-slate-800">
              💡 Tipp: Ziehe einen Endpoint per <strong>Drag & Drop</strong> direkt auf den Canvas.
            </div>

            <div className="space-y-1.5">
              {project.endpoints.map((ep) => (
                <div
                  key={ep.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/eventflow',
                      JSON.stringify({ type: 'endpoint', id: ep.id, path: ep.path, method: ep.method })
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="p-2.5 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg text-xs flex flex-col gap-1.5 group hover:border-blue-400 dark:hover:border-blue-500/50 cursor-grab active:cursor-grabbing transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 shrink-0" />
                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-1 rounded text-[10px] font-bold">
                      {ep.method}
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 truncate flex-1" title={ep.path}>
                      {ep.path}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onEditEndpoint(ep.id)}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Endpoint bearbeiten"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteEndpoint(ep)}
                        className="text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Endpoint löschen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{ep.params.length} Params</span>
                    <button
                      onClick={() => placeEndpointOnBoard(ep)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium flex items-center gap-1 hover:underline"
                    >
                      + Aufs Board
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span>EventFlow v0.1.0</span>
        <span className="text-amber-600 dark:text-amber-400 font-medium">Modul 1: UI/API</span>
      </div>

      {/* Confirmation Modal when deleting an item that is in use */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 dark:text-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {deleteConfirmation.type === 'model'
                    ? `Model "${deleteConfirmation.name}" wirklich löschen?`
                    : deleteConfirmation.type === 'endpoint'
                    ? `Endpoint "${deleteConfirmation.name}" wirklich löschen?`
                    : `Flow "${deleteConfirmation.name}" wirklich löschen?`}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {deleteConfirmation.type === 'board'
                    ? 'Beim Löschen dieses Flows werden alle darin enthaltenen Elemente sowie Verweise aus anderen Flows unwiderruflich entfernt:'
                    : 'Dieses Element wird aktuell noch in deinem Projekt verwendet. Beim Löschen werden auch die zugehörigen Nodes und Verbindungen entfernt:'}
                </p>
              </div>
            </div>

            {/* List of usages */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              {typeof deleteConfirmation.usages.nodeCount === 'number' && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Elemente auf diesem Flow:</span>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded font-semibold text-[11px]">
                      {deleteConfirmation.usages.nodeCount} Nodes
                    </span>
                  </div>
                </div>
              )}

              {deleteConfirmation.usages.boards.length > 0 && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {deleteConfirmation.type === 'board' ? 'Referenziert als Sub-Flow in:' : 'Platziert auf Flows/Boards:'}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {deleteConfirmation.usages.boards.map((b, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-amber-700 dark:text-amber-300 rounded font-mono text-[11px]"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {deleteConfirmation.usages.referencingModels &&
                deleteConfirmation.usages.referencingModels.length > 0 && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Als Feld-Typ in Models:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {deleteConfirmation.usages.referencingModels.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded font-mono text-[11px]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {deleteConfirmation.usages.referencingEndpoints &&
                deleteConfirmation.usages.referencingEndpoints.length > 0 && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Verknüpft in API-Endpoints:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {deleteConfirmation.usages.referencingEndpoints.map((e, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded font-mono text-[11px]"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs text-white bg-rose-600 hover:bg-rose-500 font-semibold rounded-lg shadow-lg shadow-rose-600/30 transition-colors"
              >
                Trotzdem löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
