import React from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  getBoard,
  getNode,
  removeNodes,
  nodeTitle,
  type FlowNode,
  type ScreenNode,
  type EndpointNode,
  type ModelNode,
  type UserActionNode,
  type NoteNode,
} from '@eventflow/core';
import {
  Sliders,
  Trash2,
  ExternalLink,
  Target,
  Edit3,
  Smartphone,
  Globe,
  Database,
  MousePointerClick,
  FileText,
  Info,
  Workflow,
} from 'lucide-react';

interface Props {
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  selectedEdgeId?: string | null;
  onEditModel: (modelId: string) => void;
  onEditEndpoint: (endpointId: string) => void;
  onOpenHotspots: (nodeId: string) => void;
  onDeleteNodes?: (ids: string[]) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

export const Inspector: React.FC<Props> = ({
  selectedNodeId,
  selectedNodeIds = [],
  selectedEdgeId,
  onEditModel,
  onEditEndpoint,
  onOpenHotspots,
  onDeleteNodes,
  onDeleteEdge,
}) => {
  const store = useEditorStore();
  const activeBoardId = useStore((s) => s.activeBoardId);
  const activeBoard = useStore((s) => s.project.boards.find((b) => b.id === s.activeBoardId) ?? s.project.boards[0]);
  const project = useStore((s) => s.project);

  const selectedNode = selectedNodeId && activeBoard ? getNode(activeBoard, selectedNodeId) : null;
  const selectedEdge = selectedEdgeId && activeBoard ? activeBoard.edges.find((e) => e.id === selectedEdgeId) : null;
  const isMultiSelect = selectedNodeIds.length > 1;

  const handleDeleteNode = () => {
    if (onDeleteNodes && selectedNodeIds.length > 0) {
      onDeleteNodes(selectedNodeIds);
      return;
    }
    if (!selectedNodeId) return;
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === draft.boards[0].id);
      if (b) removeNodes(b, new Set([selectedNodeId]));
    });
  };

  const handleDeleteEdge = () => {
    if (onDeleteEdge && selectedEdge) {
      onDeleteEdge(selectedEdge.id);
    }
  };

  return (
    <aside className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full z-10 select-none transition-colors">
      <div className="p-3 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span>
            {selectedEdge
              ? 'Verbindung'
              : isMultiSelect
              ? `Inspector (${selectedNodeIds.length} ausgewählt)`
              : 'Inspector'}
          </span>
        </div>
        {(selectedNode || isMultiSelect) ? (
          <button
            onClick={handleDeleteNode}
            className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
            title={isMultiSelect ? `${selectedNodeIds.length} Elemente löschen` : 'Element löschen'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : selectedEdge ? (
          <button
            onClick={handleDeleteEdge}
            className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
            title="Verbindung löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {selectedEdge ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
              <Workflow className="w-4 h-4" />
              <span>Verbindung (Pfeil)</span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Typ</div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase mt-0.5">
                  {selectedEdge.kind}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Von (Quelle)</div>
                <div className="text-xs text-slate-800 dark:text-slate-300 mt-0.5 truncate font-medium">
                  {activeBoard && getNode(activeBoard, selectedEdge.source)
                    ? nodeTitle(project, getNode(activeBoard, selectedEdge.source)!)
                    : selectedEdge.source}
                </div>
                {selectedEdge.sourceHandle && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                    Port / Zeile: {selectedEdge.sourceHandle}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Nach (Ziel)</div>
                <div className="text-xs text-slate-800 dark:text-slate-300 mt-0.5 truncate font-medium">
                  {activeBoard && getNode(activeBoard, selectedEdge.target)
                    ? nodeTitle(project, getNode(activeBoard, selectedEdge.target)!)
                    : selectedEdge.target}
                </div>
                {selectedEdge.targetHandle && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                    Port / Zeile: {selectedEdge.targetHandle}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDeleteEdge}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Verbindung löschen</span>
            </button>
          </div>
        ) : isMultiSelect ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Sliders className="w-4 h-4" />
              <span>Mehrfachauswahl</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              <strong>{selectedNodeIds.length} Elemente</strong> sind aktuell ausgewählt.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="text-slate-600 dark:text-slate-400 font-medium">Aktionen für alle ausgewählten Elemente:</div>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1 text-[11px]">
                <li>Gemeinsam verschieben per Drag & Drop</li>
                <li>Gemeinsam duplizieren per <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">Strg+D</kbd></li>
                <li>Gemeinsam kopieren per <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">Strg+C</kbd></li>
                <li>Gemeinsam löschen per <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">Entf</kbd></li>
              </ul>
            </div>
            <button
              type="button"
              onClick={handleDeleteNode}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>{selectedNodeIds.length} Elemente löschen</span>
            </button>
          </div>
        ) : selectedNode ? (
          <>
            {/* SCREEN NODE INSPECTOR */}
            {selectedNode.kind === 'screen' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                  <Smartphone className="w-4 h-4" />
                  <span>Figma Screen</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Titel des Screens
                  </label>
                  <input
                    type="text"
                    value={selectedNode.title || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      store.update((draft) => {
                        const b = draft.boards.find((item) => item.id === draft.boards[0].id);
                        const n = b?.nodes.find((item) => item.id === selectedNode.id) as ScreenNode;
                        if (n) n.title = val;
                      });
                    }}
                    placeholder="z.B. Positionen Erfassen"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Breite auf Canvas: {selectedNode.width || 240}px
                  </label>
                  <input
                    type="range"
                    min={180}
                    max={480}
                    step={10}
                    value={selectedNode.width || 240}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      store.update((draft) => {
                        const b = draft.boards.find((item) => item.id === draft.boards[0].id);
                        const n = b?.nodes.find((item) => item.id === selectedNode.id) as ScreenNode;
                        if (n) n.width = val;
                      });
                    }}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onOpenHotspots(selectedNode.id)}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center justify-center gap-2 shadow transition-colors"
                  >
                    <Target className="w-4 h-4" />
                    <span>Hotspots & Trigger bearbeiten ({selectedNode.hotspots.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* ENDPOINT NODE INSPECTOR */}
            {selectedNode.kind === 'endpoint' && (() => {
              const ep = project.endpoints.find((e) => e.id === selectedNode.endpointId);
              if (!ep) return <div>Endpoint existiert nicht mehr.</div>;
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                    <Globe className="w-4 h-4" />
                    <span>API Endpoint</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-extrabold uppercase">
                        {ep.method}
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 truncate">{ep.path}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {ep.params.length} Parameter definiert
                    </div>
                  </div>

                  <button
                    onClick={() => onEditEndpoint(ep.id)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Parameter & Methode anpassen</span>
                  </button>
                </div>
              );
            })()}

            {/* MODEL NODE INSPECTOR */}
            {selectedNode.kind === 'model' && (() => {
              const m = project.models.find((item) => item.id === selectedNode.modelId);
              if (!m) return <div>Model existiert nicht mehr.</div>;
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-sm">
                    <Database className="w-4 h-4" />
                    <span>Data Model</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-orange-600 dark:text-orange-300 text-sm truncate">{m.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.fields.length} Felder definiert</div>
                  </div>

                  <button
                    onClick={() => onEditModel(m.id)}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold rounded-lg flex items-center justify-center gap-2 shadow transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Felder im Fließtext bearbeiten</span>
                  </button>
                </div>
              );
            })()}

            {/* USER ACTION INSPECTOR */}
            {selectedNode.kind === 'userAction' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-bold text-sm">
                  <MousePointerClick className="w-4 h-4" />
                  <span>User Action</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Label der Aktion
                  </label>
                  <input
                    type="text"
                    value={selectedNode.label || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      store.update((draft) => {
                        const b = draft.boards.find((item) => item.id === draft.boards[0].id);
                        const n = b?.nodes.find((item) => item.id === selectedNode.id) as UserActionNode;
                        if (n) n.label = val;
                      });
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>
            )}

            {/* NOTE INSPECTOR */}
            {selectedNode.kind === 'note' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm">
                  <FileText className="w-4 h-4" />
                  <span>Notiz / Kommentar</span>
                </div>

                <textarea
                  rows={5}
                  value={selectedNode.text || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    store.update((draft) => {
                      const b = draft.boards.find((item) => item.id === activeBoardId);
                      const n = b?.nodes.find((item) => item.id === selectedNode.id) as NoteNode;
                      if (n) n.text = val;
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-500 font-sans"
                />
              </div>
            )}

            {/* FLOW REF (ENTRY POINT) INSPECTOR */}
            {selectedNode.kind === 'flowRef' && (() => {
              const targetB = project.boards.find((b) => b.id === selectedNode.targetBoardId);
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                    <Workflow className="w-4 h-4" />
                    <span>Flow Einstiegspunkt</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Verknüpfter Flow
                    </label>
                    <select
                      value={selectedNode.targetBoardId}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const tb = project.boards.find((b) => b.id === targetId);
                        store.update((draft) => {
                          const b = draft.boards.find((item) => item.id === activeBoardId);
                          const n = b?.nodes.find((item) => item.id === selectedNode.id);
                          if (n && n.kind === 'flowRef') {
                            n.targetBoardId = targetId;
                            if (tb) n.label = tb.name;
                          }
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      {project.boards
                        .filter((b) => b.id !== activeBoardId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.nodes.length} Nodes)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Eigener Anzeigename (optional)
                    </label>
                    <input
                      type="text"
                      value={selectedNode.label || ''}
                      placeholder={targetB?.name || 'Flow Name'}
                      onChange={(e) => {
                        const val = e.target.value;
                        store.update((draft) => {
                          const b = draft.boards.find((item) => item.id === activeBoardId);
                          const n = b?.nodes.find((item) => item.id === selectedNode.id);
                          if (n && n.kind === 'flowRef') {
                            n.label = val;
                          }
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {targetB && (
                    <button
                      type="button"
                      onClick={() => store.setActiveBoard(targetB.id)}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow transition-colors text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Zu "{targetB.name}" wechseln</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
            <Sliders className="w-8 h-8 mb-2 opacity-30 stroke-[1.5]" />
            <p className="font-medium text-slate-700 dark:text-slate-300">Kein Element ausgewählt</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
              Klicke auf einen Node oder eine Verbindung, um Eigenschaften anzuzeigen.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
