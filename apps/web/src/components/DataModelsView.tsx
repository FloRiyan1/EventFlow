import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  SelectionMode,
  OnConnect,
  Connection,
} from '@xyflow/react';
import { useStore, useEditorStore } from '../storeContext';
import {
  createModel,
  createModelBoard,
  deleteBoard,
  deleteModel,
  modelUsages,
  getModelHierarchyInfo,
  insertModelWithSubModels,
  referencedTypeNames,
  reorderModelField,
  sortModelFields,
  computeErdLayout,
  calculateAlignmentSnap,
  snapToGridValue,
  alignNodes,
  uid,
  type Model,
  type FieldSortCriterion,
  type Project,
  type AlignmentGuideLine,
  type AlignmentMode,
} from '@eventflow/core';
import {
  Database,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  FileCode,
  Layers,
  ArrowRight,
  CornerDownRight,
  AlertTriangle,
  Network,
  ListTree,
  Check,
  X,
  ExternalLink,
  Workflow,
  Filter,
  RotateCcw,
  Coffee,
  PanelLeftClose,
  PanelLeft,
  Hand,
  BoxSelect,
  Magnet,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  MapPin,
  FileText,
  GripVertical,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../themeContext';
import { useCollaboration } from '../collaborationContext';
import { ModelNode } from '../nodes/ModelNode';
import { NoteNode } from '../nodes/NoteNode';
import { StepWithDeleteEdge } from '../edges/StepWithDeleteEdge';
import { AlignmentGuideLines } from './AlignmentGuideLines';
import { MultiplayerCursors } from './MultiplayerCursors';
import { ContextMenu, type ContextMenuTarget } from './ContextMenu';

interface DataModelsViewProps {
  onEditModel: (modelId: string) => void;
  onOpenPlantUmlExport?: () => void;
  onOpenPlantUmlImport?: () => void;
  onOpenJavaModal?: (tab?: 'export' | 'import', modelId?: string) => void;
  onOpenAiModal?: () => void;
  onShowToast?: (msg: string) => void;
}

// -----------------------------------------------------------------------------
// ERD Node Types (For the Auto-Layout Diagram view)
// -----------------------------------------------------------------------------
const ErdModelNode: React.FC<{
  data: {
    model: Model;
    isRoot: boolean;
    parentNames: string[];
    onEdit: () => void;
    onFocus?: () => void;
    isFocused?: boolean;
  };
}> = ({ data }) => {
  const { model, isRoot, parentNames, onEdit, onFocus, isFocused } = data;
  return (
    <div
      onDoubleClick={onEdit}
      className={`min-w-[240px] max-w-[320px] bg-white dark:bg-slate-900 rounded-xl shadow-lg border-2 transition-all ${
        isFocused
          ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-orange-500/20'
          : isRoot
          ? 'border-blue-500/80 shadow-blue-500/10'
          : 'border-orange-500/80 shadow-orange-500/10'
      }`}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!w-3.5 !h-3.5 !bg-orange-500 border-2 border-white dark:border-slate-900 shadow-sm"
      />

      {/* Card Header */}
      <div
        className={`px-3 py-2 rounded-t-[10px] flex items-center justify-between gap-2 border-b ${
          isFocused
            ? 'bg-orange-100/70 dark:bg-orange-950/70 border-orange-300 dark:border-orange-800'
            : isRoot
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60'
            : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/60'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Database
            className={`w-3.5 h-3.5 shrink-0 ${
              isFocused
                ? 'text-orange-600 dark:text-orange-400'
                : isRoot
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-orange-600 dark:text-orange-400'
            }`}
          />
          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
            {model.name}
          </span>
          {isFocused && (
            <span className="text-[10px] bg-orange-200 dark:bg-orange-900/80 text-orange-800 dark:text-orange-200 px-1 rounded font-semibold shrink-0">
              Fokus
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onFocus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className={`p-1 rounded transition-colors ${
                isFocused
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                isFocused
                  ? 'Fokus aufheben (Alle Modelle anzeigen)'
                  : `Nur "${model.name}" und dessen Untermodelle im Diagramm anzeigen`
              }
            >
              <Filter className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Model bearbeiten"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Field List */}
      <div className="p-2 space-y-1 text-[11px] max-h-60 overflow-y-auto">
        {model.fields.length === 0 ? (
          <div className="text-[10px] text-slate-400 dark:text-slate-500 italic py-1 text-center">
            Keine Felder vorhanden
          </div>
        ) : (
          model.fields.map((f) => {
            const refs = referencedTypeNames(f.type);
            const isSubModelField = refs.length > 0;
            return (
              <div
                key={f.id}
                className="flex items-center justify-between gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-1 truncate">
                  <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                    {f.name}
                  </span>
                  {f.nullable && (
                    <span className="text-[9px] text-slate-400 font-mono">?</span>
                  )}
                </div>
                <span
                  className={`font-mono text-[10px] px-1 py-0.2 rounded truncate shrink-0 ${
                    isSubModelField
                      ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-semibold border border-orange-300 dark:border-orange-800/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                  title={f.type}
                >
                  {f.type}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950/40 rounded-b-[10px] border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>{model.fields.length} Felder</span>
        {isRoot ? (
          <span className="text-blue-600 dark:text-blue-400 font-medium">Hauptmodell</span>
        ) : (
          <span className="text-orange-600 dark:text-orange-400 font-medium">
            Untermodell ({parentNames.length}x)
          </span>
        )}
      </div>

      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-3.5 !h-3.5 !bg-orange-500 border-2 border-white dark:border-slate-900 shadow-sm"
      />
    </div>
  );
};

const erdNodeTypes = {
  erdModel: ErdModelNode,
};

// -----------------------------------------------------------------------------
// Free Model Canvas Node & Edge Types
// -----------------------------------------------------------------------------
const freeCanvasNodeTypes = {
  model: ModelNode,
  note: NoteNode,
};

const freeCanvasEdgeTypes = {
  step: StepWithDeleteEdge,
  default: StepWithDeleteEdge,
};

// Recursive Model Card component for Tree/Hierarchy view
interface TreeModelCardProps {
  model: Model;
  allModels: Model[];
  visitedModelIds: Set<string>;
  expandedModelIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEditModel: (id: string) => void;
  onDeleteModel: (model: Model) => void;
  onFocusModel: (name: string) => void;
  onOpenInErd?: (modelId: string) => void;
  onOpenJavaModal?: (tab?: 'export' | 'import', modelId?: string) => void;
  onShowToast?: (msg: string) => void;
  depth?: number;
}

const TreeModelCard: React.FC<TreeModelCardProps> = ({
  model,
  allModels,
  visitedModelIds,
  expandedModelIds,
  onToggleExpand,
  onEditModel,
  onDeleteModel,
  onFocusModel,
  onOpenInErd,
  onOpenJavaModal,
  onShowToast,
  depth = 0,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);

  const hierarchy = useMemo(() => {
    return getModelHierarchyInfo(project, model.id);
  }, [project, model.id]);

  const isExpanded = expandedModelIds.has(model.id);

  const handleInsertToBoard = (includeSubModels: boolean) => {
    let count = 1;
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === store.getState().activeBoardId) ?? draft.boards[0];
      if (!b) return;
      const x = 300 + Math.random() * 120;
      const y = 600 + Math.random() * 60;
      if (includeSubModels) {
        const res = insertModelWithSubModels(b, draft, model.id, {
          basePosition: { x, y },
        });
        count = res.createdNodeIds.length;
      } else {
        b.nodes.push({
          id: uid('n_'),
          kind: 'model',
          modelId: model.id,
          position: { x, y },
        });
      }
    });
    if (onShowToast) {
      onShowToast(
        includeSubModels
          ? `✨ "${model.name}" und ${count - 1} Untermodelle aufs Board eingefügt!`
          : `✓ "${model.name}" aufs Board eingefügt!`
      );
    }
  };

  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('String');
  const [newFieldNullable, setNewFieldNullable] = useState(false);

  const handleSaveNewField = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    store.update((draft) => {
      const m = draft.models.find((item) => item.id === model.id);
      if (m) {
        m.fields.push({
          id: uid('f_'),
          name: trimmed,
          type: newFieldType.trim() || 'String',
          nullable: newFieldNullable,
        });
      }
    });
    setNewFieldName('');
    setIsAddingField(false);
  };

  const handleMoveField = (index: number, delta: number) => {
    store.update((draft) => {
      const m = draft.models.find((item) => item.id === model.id);
      if (m) {
        reorderModelField(m, index, index + delta);
      }
    });
  };

  const handleSort = (criterion: FieldSortCriterion) => {
    store.update((draft) => {
      const m = draft.models.find((item) => item.id === model.id);
      if (m) {
        sortModelFields(draft, m, criterion);
      }
    });
    if (onShowToast) {
      const label =
        criterion === 'name-asc'
          ? 'A–Z'
          : criterion === 'name-desc'
          ? 'Z–A'
          : criterion === 'type-asc'
          ? 'Datentyp'
          : criterion === 'required-first'
          ? 'Pflichtfelder zuerst'
          : 'Untermodelle zuerst';
      onShowToast(`Felder in "${model.name}" sortiert (${label})`);
    }
  };

  const modelMap = useMemo(() => {
    return new Map(allModels.map((m) => [m.name, m]));
  }, [allModels]);

  const nextVisited = useMemo(() => {
    const s = new Set(visitedModelIds);
    s.add(model.id);
    return s;
  }, [visitedModelIds, model.id]);

  return (
    <div
      id={`model-card-${model.id}`}
      className={`rounded-xl border transition-all ${
        depth === 0
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
          : 'bg-orange-50/40 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900/50 mt-2 ml-4'
      }`}
    >
      {/* Model Header */}
      <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
          <button
            onClick={() => onToggleExpand(model.id)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            title={isExpanded ? 'Zuklappen' : 'Aufklappen'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              hierarchy.isRoot
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400'
            }`}
          >
            <Database className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {model.name}
              </span>

              {hierarchy.isRoot ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                  Hauptmodell
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-900/60 flex items-center gap-1">
                  <span>Untermodell</span>
                  {hierarchy.parentModels.length > 0 && (
                    <span className="text-[9px] opacity-75">
                      (in {hierarchy.parentModels.map((p) => p.name).join(', ')})
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{model.fields.length} Felder</span>
              <span>•</span>
              <span
                className={
                  hierarchy.subModels.length > 0
                    ? 'text-orange-600 dark:text-orange-400 font-medium'
                    : ''
                }
              >
                {hierarchy.subModels.length}{' '}
                {hierarchy.subModels.length === 1 ? 'Untermodell' : 'Untermodelle'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleInsertToBoard(false)}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
            title="Dieses Model auf das Modell-Canvas platzieren"
          >
            <Workflow className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Aufs Canvas</span>
          </button>

          {hierarchy.subModels.length > 0 && (
            <button
              onClick={() => handleInsertToBoard(true)}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60 border border-orange-300 dark:border-orange-800/60 flex items-center gap-1 transition-colors"
              title={`"${model.name}" inklusive aller ${hierarchy.subModels.length} Untermodelle auf dem Canvas platzieren`}
            >
              <Network className="w-3.5 h-3.5 text-orange-500" />
              <span>+ Inkl. Untermodelle</span>
            </button>
          )}

          <button
            onClick={() => setIsAddingField(!isAddingField)}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
            title="Neues Feld hinzufügen"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Feld</span>
          </button>

          {onOpenInErd && (
            <button
              onClick={() => onOpenInErd(model.id)}
              className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center gap-1 transition-colors"
              title={`"${model.name}" im Modell-Diagramm (ERD) isolieren & anzeigen`}
            >
              <Network className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden md:inline">Diagramm</span>
            </button>
          )}

          {onOpenJavaModal && (
            <button
              onClick={() => onOpenJavaModal('export', model.id)}
              className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1 transition-colors"
              title={`Java-Code für "${model.name}" generieren`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">Java</span>
            </button>
          )}

          <button
            onClick={() => onEditModel(model.id)}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center gap-1 transition-colors"
            title="Model in Schnelleditor öffnen"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bearbeiten</span>
          </button>

          <button
            onClick={() => onDeleteModel(model)}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Model löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Body: Fields & Nested Submodels */}
      {isExpanded && (
        <div className="p-3.5 space-y-3">
          {/* Inline Add Field Form */}
          {isAddingField && (
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Neues Feld für {model.name} hinzufügen</span>
                <button
                  onClick={() => setIsAddingField(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Feldname (z.B. id, user, eintraege)"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNewField();
                    if (e.key === 'Escape') setIsAddingField(false);
                  }}
                  autoFocus
                  className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 flex-1 min-w-[140px]"
                />
                <input
                  type="text"
                  placeholder="Typ (z.B. String, int, List<SubModel>)"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNewField();
                    if (e.key === 'Escape') setIsAddingField(false);
                  }}
                  className="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 w-44"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newFieldNullable}
                    onChange={(e) => setNewFieldNullable(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span>Optional (?)</span>
                </label>
                <button
                  onClick={handleSaveNewField}
                  disabled={!newFieldName.trim()}
                  className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Speichern</span>
                </button>
              </div>
            </div>
          )}

          {/* Fields list */}
          {model.fields.length === 0 ? (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
              Keine Felder definiert. Klicke auf &quot;+ Feld&quot;, um Attribute hinzuzufügen.
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {model.fields.length} {model.fields.length === 1 ? 'Attribut' : 'Attribute'}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mr-0.5 flex items-center gap-0.5">
                    <ArrowUpDown className="w-3 h-3" /> Sortieren:
                  </span>
                  <button
                    onClick={() => handleSort('name-asc')}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Alphabetisch sortieren (A - Z)"
                  >
                    A–Z
                  </button>
                  <button
                    onClick={() => handleSort('name-desc')}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Alphabetisch absteigend sortieren (Z - A)"
                  >
                    Z–A
                  </button>
                  <button
                    onClick={() => handleSort('type-asc')}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Nach Typ sortieren"
                  >
                    Typ
                  </button>
                  <button
                    onClick={() => handleSort('required-first')}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Pflichtfelder zuerst"
                  >
                    Pflicht
                  </button>
                  <button
                    onClick={() => handleSort('submodels-first')}
                    className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Untermodelle zuerst"
                  >
                    Sub-Modelle
                  </button>
                </div>
              </div>

              <div className="overflow-hidden border border-slate-200/80 dark:border-slate-800/80 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                      <th className="py-2 px-2 w-14 text-center">Pos</th>
                      <th className="py-2 px-3">Feldname</th>
                      <th className="py-2 px-3">Typ</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Untermodell-Referenz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {model.fields.map((field, idx, arr) => {
                      const refs = referencedTypeNames(field.type);
                      const referencedModels = refs
                        .map((name) => modelMap.get(name))
                        .filter((m): m is Model => !!m);

                      return (
                        <tr
                          key={field.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                disabled={idx === 0}
                                onClick={() => handleMoveField(idx, -1)}
                                className="p-0.5 text-slate-400 hover:text-orange-500 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                title="Nach oben verschieben"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveField(idx, 1)}
                                className="p-0.5 text-slate-400 hover:text-orange-500 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                title="Nach unten verschieben"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {field.name}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {field.type}
                          </td>
                          <td className="py-2 px-3">
                            {field.nullable ? (
                              <span className="text-[10px] text-slate-400 font-mono">optional (?)</span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">erforderlich</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {referencedModels.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {referencedModels.map((target) => (
                                  <button
                                    key={target.id}
                                    onClick={() => onFocusModel(target.name)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60 border border-orange-300 dark:border-orange-800 transition-colors"
                                    title={`Zu Untermodell ${target.name} springen`}
                                  >
                                    <CornerDownRight className="w-3 h-3" />
                                    <span>↳ {target.name}</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Nested Sub-models Rendering Section */}
          {hierarchy.subModels.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                <CornerDownRight className="w-3.5 h-3.5" />
                <span>
                  Untermodelle von {model.name} ({hierarchy.subModels.length})
                </span>
              </div>

              <div className="space-y-2 pl-2 border-l-2 border-orange-300 dark:border-orange-700/60">
                {hierarchy.subModels.map(({ field, model: subModel }) => {
                  const isCircular = visitedModelIds.has(subModel.id);

                  if (isCircular) {
                    return (
                      <div
                        key={`${field.id}-${subModel.id}`}
                        className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-lg text-xs flex items-center gap-2 text-amber-800 dark:text-amber-300"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                        <span>
                          <strong>Zirkuläre Referenz:</strong> Feld{' '}
                          <code>{field.name}</code> referenziert <strong>{subModel.name}</strong>, welches bereits im oberen Hierarchiepfad liegt.
                        </span>
                        <button
                          onClick={() => onFocusModel(subModel.name)}
                          className="ml-auto underline hover:text-amber-950 dark:hover:text-amber-100 shrink-0"
                        >
                          Anzeigen
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={`${field.id}-${subModel.id}`} className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pl-1">
                        <span>Feld:</span>
                        <code className="text-orange-600 dark:text-orange-300 font-mono">
                          {field.name}: {field.type}
                        </code>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span>Referenziert Untermodell:</span>
                      </div>

                      <TreeModelCard
                        model={subModel}
                        allModels={allModels}
                        visitedModelIds={nextVisited}
                        expandedModelIds={expandedModelIds}
                        onToggleExpand={onToggleExpand}
                        onEditModel={onEditModel}
                        onDeleteModel={onDeleteModel}
                        onFocusModel={onFocusModel}
                        onOpenInErd={onOpenInErd}
                        onOpenJavaModal={onOpenJavaModal}
                        onShowToast={onShowToast}
                        depth={depth + 1}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Collect a model's subtree (and optionally parent models)
function collectSubtreeModelIds(
  project: Project,
  rootModelId: string,
  includeParents = false
): Set<string> {
  const result = new Set<string>();
  const queue = [rootModelId];
  result.add(rootModelId);
  const modelMap = new Map(project.models.map((m) => [m.name, m]));

  // 1. Descendants
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentModel = project.models.find((m) => m.id === currentId);
    if (!currentModel) continue;

    for (const field of currentModel.fields) {
      const refs = referencedTypeNames(field.type);
      for (const refName of refs) {
        const refModel = modelMap.get(refName);
        if (refModel && !result.has(refModel.id)) {
          result.add(refModel.id);
          queue.push(refModel.id);
        }
      }
    }
  }

  // 2. Parents (optional)
  if (includeParents) {
    const parentQueue = [rootModelId];
    const visitedParents = new Set([rootModelId]);

    while (parentQueue.length > 0) {
      const targetId = parentQueue.shift()!;
      const targetModel = project.models.find((m) => m.id === targetId);
      if (!targetModel) continue;

      for (const candidate of project.models) {
        if (visitedParents.has(candidate.id)) continue;
        const refs = candidate.fields.flatMap((f) => referencedTypeNames(f.type));
        if (refs.includes(targetModel.name)) {
          result.add(candidate.id);
          visitedParents.add(candidate.id);
          parentQueue.push(candidate.id);
        }
      }
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Free Model Canvas Inner Component (Active ReactFlow Canvas)
// -----------------------------------------------------------------------------
interface FreeModelCanvasInnerProps {
  boardId: string;
  onEditModel: (modelId: string) => void;
  onShowToast?: (msg: string) => void;
  onOpenJavaModal?: (tab?: 'export' | 'import', modelId?: string) => void;
  onOpenAiModal?: () => void;
}

const FreeModelCanvasInner: React.FC<FreeModelCanvasInnerProps> = ({
  boardId,
  onEditModel,
  onShowToast,
  onOpenJavaModal,
  onOpenAiModal,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const { theme } = useTheme();
  const { manager } = useCollaboration();
  const { screenToFlowPosition, fitView } = useReactFlow();

  const board = useMemo(() => {
    return project.boards.find((b) => b.id === boardId) ?? project.boards[0];
  }, [project.boards, boardId]);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [guideLines, setGuideLines] = useState<{
    vertical: AlignmentGuideLine | null;
    horizontal: AlignmentGuideLine | null;
  }>({ vertical: null, horizontal: null });

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextMenuTarget;
  } | null>(null);

  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 300, y: 300 });

  const triggerPing = useCallback(
    (flowPos?: { x: number; y: number }) => {
      const pos = flowPos || lastMousePosRef.current;
      manager.broadcastPing(pos.x, pos.y, boardId);
      onShowToast?.('📍 Ping auf Modell-Canvas gesendet!');
    },
    [manager, boardId, onShowToast]
  );

  // Key shortcut for canvas ping ('P')
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        triggerPing();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerPing]);

  // Transform domain nodes into ReactFlow nodes
  const rfNodes = useMemo<Node[]>(() => {
    return board.nodes.map((node) => {
      let injectedData: Record<string, unknown> = { ...node };
      if (node.kind === 'model') {
        const m = project.models.find((item) => item.id === node.modelId);
        injectedData = {
          ...node,
          model: m,
          fields: m ? [...m.fields] : [],
        };
      }
      return {
        id: node.id,
        type: node.kind,
        position: node.position,
        data: injectedData,
        style: {
          width: node.width ?? undefined,
          height: node.height ?? undefined,
        },
      };
    });
  }, [board.nodes, project.models]);

  // Transform domain edges into ReactFlow edges
  const rfEdges = useMemo<Edge[]>(() => {
    return board.edges.map((edge) => ({
      id: edge.id,
      type: 'step',
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || 'bottom',
      targetHandle: edge.targetHandle || 'top',
      label: edge.label || undefined,
      selected: edge.id === selectedEdgeId,
      style: { stroke: '#f97316', strokeWidth: 2 },
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#f97316',
        width: 14,
        height: 14,
      },
    }));
  }, [board.edges, selectedEdgeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]));
      return rfNodes.map((newNode) => {
        const prev = prevMap.get(newNode.id);
        if (!prev) {
          return {
            ...newNode,
            selected: selectedNodeIds.includes(newNode.id),
          };
        }
        return {
          ...newNode,
          selected: prev.selected ?? selectedNodeIds.includes(newNode.id),
          measured: prev.measured,
          style: {
            ...newNode.style,
            width: newNode.style?.width ?? prev.style?.width,
            height: newNode.style?.height ?? prev.style?.height,
          },
        };
      });
    });
  }, [rfNodes, setNodes]);

  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdges, setEdges]);

  // Sync external selection into nodes state smoothly
  useEffect(() => {
    setNodes((prevNodes) => {
      let changed = false;
      const updated = prevNodes.map((n) => {
        const isSelected = selectedNodeIds.includes(n.id);
        if (n.selected === isSelected) return n;
        changed = true;
        return { ...n, selected: isSelected };
      });
      return changed ? updated : prevNodes;
    });
  }, [selectedNodeIds, setNodes]);

  // Connecting model nodes
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const newEdgeId = uid('e_');
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === boardId);
        if (!b) return;

        // Check if edge already exists
        const exists = b.edges.some(
          (e) => e.source === connection.source && e.target === connection.target
        );
        if (exists) return;

        b.edges.push({
          id: newEdgeId,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || 'bottom',
          targetHandle: connection.targetHandle || 'top',
          kind: 'flow',
          label: '',
        });
      });
      onShowToast?.('🔗 Beziehung zwischen Modellen verbunden!');
    },
    [store, boardId, onShowToast]
  );

  // Moving nodes with snap to grid and alignment guides
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      if (isSnapEnabled) {
        const draggingChanges = changes.filter(
          (c) => c.type === 'position' && c.dragging && c.position
        );

        if (draggingChanges.length === 1) {
          const change = draggingChanges[0];
          const draggedNode = nodes.find((n) => n.id === change.id);

          if (draggedNode && change.position) {
            const candidate = {
              ...draggedNode,
              position: change.position,
            };

            const otherNodes = nodes.filter((n) => n.id !== change.id);
            const snapRes = calculateAlignmentSnap(candidate, otherNodes, 10);

            let nextX = snapRes.x;
            let nextY = snapRes.y;

            if (!snapRes.verticalLine) {
              nextX = snapToGridValue(nextX, 20);
            }
            if (!snapRes.horizontalLine) {
              nextY = snapToGridValue(nextY, 20);
            }

            change.position = { x: nextX, y: nextY };
            setGuideLines({
              vertical: snapRes.verticalLine,
              horizontal: snapRes.horizontalLine,
            });
          }
        } else if (draggingChanges.length > 1) {
          for (const change of draggingChanges) {
            if (change.position) {
              change.position = {
                x: snapToGridValue(change.position.x, 20),
                y: snapToGridValue(change.position.y, 20),
              };
            }
          }
          if (guideLines.vertical || guideLines.horizontal) {
            setGuideLines({ vertical: null, horizontal: null });
          }
        } else {
          if (guideLines.vertical || guideLines.horizontal) {
            setGuideLines({ vertical: null, horizontal: null });
          }
        }
      } else {
        if (guideLines.vertical || guideLines.horizontal) {
          setGuideLines({ vertical: null, horizontal: null });
        }
      }

      onNodesChange(changes);
    },
    [isSnapEnabled, nodes, onNodesChange, guideLines]
  );

  // Node drag stop: persist position to history
  const handleNodesMoved = useCallback(
    (movedNodes: Node[]) => {
      if (!movedNodes || movedNodes.length === 0) return;
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === boardId);
        if (!b) return;
        for (const moved of movedNodes) {
          const targetNode = b.nodes.find((n) => n.id === moved.id);
          if (targetNode) {
            targetNode.position = {
              x: Math.round(moved.position.x),
              y: Math.round(moved.position.y),
            };
          }
        }
      });
    },
    [store, boardId]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node, movedNodes: Node[]) => {
      setGuideLines({ vertical: null, horizontal: null });
      handleNodesMoved(movedNodes && movedNodes.length > 0 ? movedNodes : [node]);
    },
    [handleNodesMoved]
  );

  const onSelectionDragStop = useCallback(
    (_: unknown, movedNodes: Node[]) => {
      setGuideLines({ vertical: null, horizontal: null });
      handleNodesMoved(movedNodes);
    },
    [handleNodesMoved]
  );

  // Drag-and-drop from models sidebar onto canvas
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const rawData = e.dataTransfer.getData('application/eventflow');
      if (rawData) {
        try {
          const item = JSON.parse(rawData);
          if (item.type === 'model') {
            const newNodeId = uid('n_');
            store.update((draft) => {
              const b = draft.boards.find((item) => item.id === boardId);
              if (!b) return;

              // Check if already on board
              const existing = b.nodes.find(
                (n) => n.kind === 'model' && n.modelId === item.id
              );
              if (existing) {
                existing.position = {
                  x: Math.round(flowPos.x),
                  y: Math.round(flowPos.y),
                };
                return;
              }

              b.nodes.push({
                id: newNodeId,
                kind: 'model',
                modelId: item.id,
                position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
              });
            });
            setSelectedNodeIds([newNodeId]);
            onShowToast?.(`✓ Model "${item.name}" platziert!`);
            return;
          }
        } catch (_) {}
      }
    },
    [screenToFlowPosition, store, boardId, onShowToast]
  );

  // Auto-Arrange: One-click neat layout using computeErdLayout
  const handleAutoArrange = useCallback(() => {
    const boardModels = board.nodes
      .filter((n) => n.kind === 'model')
      .map((n) => project.models.find((m) => m.id === (n as any).modelId))
      .filter((m): m is Model => !!m);

    if (boardModels.length === 0) return;

    const layout = computeErdLayout(boardModels);

    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === boardId);
      if (!b) return;

      for (const node of b.nodes) {
        if (node.kind === 'model') {
          const pos = layout.get(node.modelId);
          if (pos) {
            node.position = pos;
          }
        }
      }
    });

    setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 50);

    onShowToast?.('✨ Modelle automatisch und kollisionsfrei angeordnet!');
  }, [board.nodes, project.models, store, boardId, fitView, onShowToast]);

  // Context menu actions
  const handleCreateNewModelAt = useCallback(
    (flowPos: { x: number; y: number }) => {
      const newModel = createModel(`NeuesModel${project.models.length + 1}`);
      const newNodeId = uid('n_');
      store.update((draft) => {
        draft.models.push(newModel);
        const b = draft.boards.find((item) => item.id === boardId);
        if (b) {
          b.nodes.push({
            id: newNodeId,
            kind: 'model',
            modelId: newModel.id,
            position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
          });
        }
      });
      setSelectedNodeIds([newNodeId]);
      onEditModel(newModel.id);
      onShowToast?.(`✓ Model "${newModel.name}" erstellt!`);
    },
    [project.models.length, store, boardId, onEditModel, onShowToast]
  );

  const handleCreateNoteAt = useCallback(
    (flowPos: { x: number; y: number }) => {
      const newNodeId = uid('n_');
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === boardId);
        if (b) {
          b.nodes.push({
            id: newNodeId,
            kind: 'note',
            text: 'Neue Notiz für Datenmodelle',
            position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
          });
        }
      });
      setSelectedNodeIds([newNodeId]);
      onShowToast?.('📝 Notiz erstellt!');
    },
    [store, boardId, onShowToast]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === boardId);
        if (b) {
          b.edges = b.edges.filter((e) => e.id !== edgeId);
        }
      });
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
      onShowToast?.('🗑️ Verbindung gelöscht!');
    },
    [store, boardId, selectedEdgeId, onShowToast]
  );

  // Listen to edge delete events from StepWithDeleteEdge
  useEffect(() => {
    const onEdgeDeleteEvent = (e: CustomEvent<{ edgeId: string }>) => {
      handleDeleteEdge(e.detail.edgeId);
    };
    window.addEventListener('eventflow:delete-edge' as any, onEdgeDeleteEvent);
    return () =>
      window.removeEventListener('eventflow:delete-edge' as any, onEdgeDeleteEvent);
  }, [handleDeleteEdge]);

  // Align selection
  const handleAlign = useCallback(
    (mode: AlignmentMode) => {
      if (selectedNodeIds.length <= 1) return;
      const nodesToAlign = board.nodes.filter((n) => selectedNodeIds.includes(n.id));
      const updates = alignNodes(nodesToAlign, mode);
      if (updates.length > 0) {
        store.update((draft) => {
          const b = draft.boards.find((item) => item.id === boardId);
          if (!b) return;
          for (const u of updates) {
            const n = b.nodes.find((item) => item.id === u.id);
            if (n) {
              n.position = u.position;
            }
          }
        });
        onShowToast?.('✨ Modelle ausgerichtet!');
      }
    },
    [selectedNodeIds, board.nodes, store, boardId, onShowToast]
  );

  return (
    <div
      className="w-full h-full relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerMove={(e) => {
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        lastMousePosRef.current = flowPos;
        manager.updateCursor(flowPos);
      }}
      onPointerLeave={() => {
        manager.updateCursor(null);
      }}
    >
      {/* Floating Canvas Mode Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 shadow-xl backdrop-blur-md text-xs transition-colors">
        <button
          type="button"
          onClick={() => setIsSelectMode(false)}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
            !isSelectMode
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Verschieben: Canvas mit linker Maustaste ziehen"
        >
          <Hand className="w-3.5 h-3.5" />
          <span>Verschieben</span>
        </button>
        <button
          type="button"
          onClick={() => setIsSelectMode(true)}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
            isSelectMode
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Rahmen-Auswahl: Rechteck ziehen zum Markieren"
        >
          <BoxSelect className="w-3.5 h-3.5" />
          <span>Auswahl</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Snap / Magnet Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !isSnapEnabled;
            setIsSnapEnabled(next);
            onShowToast?.(
              next
                ? '🧲 Raster- & Mitten-Fang aktiviert'
                : 'Freies Verschieben (Fang deaktiviert)'
            );
          }}
          className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
            isSnapEnabled
              ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
          title="Raster- & Mitten-Fang"
        >
          <Magnet
            className={`w-3.5 h-3.5 ${
              isSnapEnabled ? 'text-amber-500 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span>Snap</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Quick Add Model on Canvas */}
        <button
          type="button"
          onClick={() => handleCreateNewModelAt(lastMousePosRef.current)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 shadow-sm transition-colors"
          title="Neues Model direkt auf dem Canvas erstellen"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Model</span>
        </button>

        {/* Add Note on Canvas */}
        <button
          type="button"
          onClick={() => handleCreateNoteAt(lastMousePosRef.current)}
          className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
          title="Notiz / Dokumentations-Block hinzufügen"
        >
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>Notiz</span>
        </button>

        {/* Auto Arrange */}
        <button
          type="button"
          onClick={handleAutoArrange}
          className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Alle Modelle auf dem Canvas automatisch und ordentlich anordnen"
        >
          <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
          <span>Anordnen</span>
        </button>

        {/* Ping / Radar Attention */}
        <button
          type="button"
          onClick={() => triggerPing()}
          className="px-2 py-1.5 rounded-lg flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Radar-Ping senden (Taste 'P' oder Alt+Klick auf Canvas)"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-500" />
          <span>Ping</span>
        </button>

        {/* Java Code Modal */}
        {onOpenJavaModal && (
          <button
            type="button"
            onClick={() => {
              const selectedModelNode = board.nodes.find(
                (n) => selectedNodeIds.includes(n.id) && n.kind === 'model'
              );
              onOpenJavaModal(
                'export',
                selectedModelNode && selectedModelNode.kind === 'model'
                  ? selectedModelNode.modelId
                  : undefined
              );
            }}
            className="px-2 py-1.5 rounded-lg flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Java-Code exportieren / importieren"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-500" />
            <span>Java</span>
          </button>
        )}

        {/* Local AI Assistant Integration */}
        {onOpenAiModal && (
          <button
            type="button"
            onClick={onOpenAiModal}
            className="px-2 py-1.5 rounded-lg flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Lokale KI (Open WebUI / Ollama) zur Datenmodellierung nutzen"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>KI</span>
          </button>
        )}

        {/* Multi-Selection Tools */}
        {selectedNodeIds.length > 1 && (
          <>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() => handleAlign('centerH')}
              className="px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
              title="Horizontal mittig ausrichten"
            >
              <AlignHorizontalJustifyCenter className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden sm:inline">Mitte H</span>
            </button>
            <button
              type="button"
              onClick={() => handleAlign('centerV')}
              className="px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
              title="Vertikal mittig ausrichten"
            >
              <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden sm:inline">Mitte V</span>
            </button>
            <span className="ml-1 px-2 py-0.5 bg-orange-500/20 text-orange-700 dark:text-orange-300 font-semibold text-[11px] rounded-lg border border-orange-500/30">
              {selectedNodeIds.length} markiert
            </span>
          </>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={freeCanvasNodeTypes}
        edgeTypes={freeCanvasEdgeTypes}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStop={onSelectionDragStop}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={isSelectMode}
        panOnDrag={isSelectMode ? [1, 2] : true}
        paneClickDistance={5}
        selectionKeyCode={['Shift', 'Control']}
        multiSelectionKeyCode={['Shift', 'Control']}
        onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
          const ids = selNodes.map((n) => n.id);
          if (
            ids.length !== selectedNodeIds.length ||
            !ids.every((id) => selectedNodeIds.includes(id))
          ) {
            setSelectedNodeIds(ids);
            manager.updateSelection(ids);
          }
          if (selNodes.length > 0) {
            setSelectedEdgeId(null);
          } else if (selEdges.length > 0) {
            setSelectedEdgeId(selEdges[0].id);
          } else {
            setSelectedEdgeId(null);
          }
        }}
        onPaneClick={(e) => {
          if (e.altKey) {
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            triggerPing(flowPos);
            return;
          }
          setGuideLines({ vertical: null, horizontal: null });
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          setSelectedEdgeId(null);
          let newSelected = selectedNodeIds;
          if (!selectedNodeIds.includes(node.id)) {
            newSelected = [node.id];
            setSelectedNodeIds(newSelected);
          }
          const flowPos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          const nodeData = board.nodes.find((n) => n.id === node.id);
          let hasSubModels = false;
          if (nodeData && nodeData.kind === 'model') {
            const info = getModelHierarchyInfo(project, nodeData.modelId);
            hasSubModels = info.subModels.length > 0;
          }
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            target: {
              type: 'node',
              nodeId: node.id,
              nodeKind: node.type,
              position: flowPos,
              selectedCount: newSelected.length,
              hasSubModels,
            },
          });
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          setSelectedNodeIds([]);
          setSelectedEdgeId(edge.id);
          const flowPos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            target: {
              type: 'edge',
              edgeId: edge.id,
              position: flowPos,
            },
          });
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setSelectedEdgeId(null);
          const flowPos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            target: {
              type: 'pane',
              position: flowPos,
            },
          });
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <AlignmentGuideLines
          verticalLine={guideLines.vertical}
          horizontalLine={guideLines.horizontal}
        />
        <MultiplayerCursors />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color={
            theme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.22)'
          }
        />
        <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !shadow-md !rounded-lg" />
        <MiniMap
          nodeColor="#f97316"
          className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !rounded-xl"
        />
      </ReactFlow>

      {/* Context Menu Dropdown */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onCopy={() => {
            setContextMenu(null);
          }}
          onPaste={(flowPos) => {
            handleCreateNewModelAt(flowPos);
            setContextMenu(null);
          }}
          onDuplicate={(nodeId) => {
            const idToDupe = nodeId || selectedNodeIds[0];
            const targetNode = board.nodes.find((n) => n.id === idToDupe);
            if (targetNode && targetNode.kind === 'model') {
              const origModel = project.models.find(
                (m) => m.id === targetNode.modelId
              );
              if (origModel) {
                const newModel = createModel(
                  `${origModel.name}Kopie`,
                  JSON.parse(JSON.stringify(origModel.fields))
                );
                const newNodeId = uid('n_');
                store.update((draft) => {
                  draft.models.push(newModel);
                  const b = draft.boards.find((item) => item.id === boardId);
                  if (b) {
                    b.nodes.push({
                      id: newNodeId,
                      kind: 'model',
                      modelId: newModel.id,
                      position: {
                        x: targetNode.position.x + 40,
                        y: targetNode.position.y + 40,
                      },
                    });
                  }
                });
                setSelectedNodeIds([newNodeId]);
                onShowToast?.(`✨ Model "${newModel.name}" dupliziert!`);
              }
            }
            setContextMenu(null);
          }}
          onDelete={(nodeId) => {
            const idsToDelete = nodeId ? [nodeId] : selectedNodeIds;
            store.update((draft) => {
              const b = draft.boards.find((item) => item.id === boardId);
              if (b) {
                b.nodes = b.nodes.filter((n) => !idsToDelete.includes(n.id));
                b.edges = b.edges.filter(
                  (e) =>
                    !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)
                );
              }
            });
            setSelectedNodeIds([]);
            onShowToast?.('🗑️ Element vom Canvas entfernt');
            setContextMenu(null);
          }}
          onDeleteEdge={(edgeId) => {
            handleDeleteEdge(edgeId);
            setContextMenu(null);
          }}
          onEdit={(nodeId) => {
            const targetNode = board.nodes.find((n) => n.id === nodeId);
            if (targetNode && targetNode.kind === 'model') {
              onEditModel(targetNode.modelId);
            }
            setContextMenu(null);
          }}
          onCreateModel={(pos) => {
            handleCreateNewModelAt(pos);
            setContextMenu(null);
          }}
          onCreateNote={(pos) => {
            handleCreateNoteAt(pos);
            setContextMenu(null);
          }}
          onAlign={handleAlign}
          hasClipboardContent={false}
        />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main DataModelsView Component
// -----------------------------------------------------------------------------
export const DataModelsView: React.FC<DataModelsViewProps> = ({
  onEditModel,
  onOpenPlantUmlExport,
  onOpenPlantUmlImport,
  onOpenJavaModal,
  onOpenAiModal,
  onShowToast,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const { theme } = useTheme();

  // Mode: 'canvas' (Freier interaktiver Canvas) vs 'tree' (Hierarchie-Baum) vs 'erd' (Auto-Diagramm)
  const [viewMode, setViewMode] = useState<'canvas' | 'tree' | 'erd'>('canvas');

  // Sidebar visibility on free canvas
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Filter: 'all' | 'root' | 'sub'
  const [filterType, setFilterType] = useState<'all' | 'root' | 'sub'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // ERD View model filter state
  const [erdFilterModelId, setErdFilterModelId] = useState<string | 'all'>('all');
  const [erdIncludeParents, setErdIncludeParents] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [layoutSeed, setLayoutSeed] = useState(0);

  // Model board renaming state
  const [editingBoardNameId, setEditingBoardNameId] = useState<string | null>(null);
  const [boardNameDraft, setBoardNameDraft] = useState('');

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    model: Model;
    usages: {
      boards: string[];
      models: string[];
      endpoints: string[];
    };
  } | null>(null);

  // Group models into Root vs Sub
  const { rootModels, subModels } = useMemo(() => {
    const roots: Model[] = [];
    const subs: Model[] = [];
    for (const m of project.models) {
      const info = getModelHierarchyInfo(project, m.id);
      if (info.isRoot) {
        roots.push(m);
      } else {
        subs.push(m);
      }
    }
    return { rootModels: roots, subModels: subs };
  }, [project]);

  // Model Boards list
  const modelBoards = useMemo(() => {
    return project.boards.filter((b) => b.kind === 'model');
  }, [project.boards]);

  // Ensure initial model board exists
  useEffect(() => {
    if (modelBoards.length === 0) {
      const newBoard = createModelBoard('Datenmodell 1');
      if (project.models.length > 0) {
        const layout = computeErdLayout(project.models);
        newBoard.nodes = project.models.map((m) => ({
          id: uid('n_'),
          kind: 'model',
          modelId: m.id,
          position: layout.get(m.id) || { x: 100, y: 100 },
        }));
      }
      store.update((draft) => {
        draft.boards.push(newBoard);
      });
      store.setActiveBoard(newBoard.id);
    }
  }, [modelBoards.length, project.models, store]);

  // Active model board
  const activeModelBoard = useMemo(() => {
    const curr = project.boards.find(
      (b) => b.id === activeBoardId && b.kind === 'model'
    );
    return curr ?? modelBoards[0] ?? project.boards[0];
  }, [project.boards, activeBoardId, modelBoards]);

  // Filtered models for sidebar and tree view
  const filteredModels = useMemo(() => {
    return project.models.filter((m) => {
      if (filterType === 'root' && !rootModels.some((r) => r.id === m.id)) return false;
      if (filterType === 'sub' && !subModels.some((s) => s.id === m.id)) return false;

      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      if (m.name.toLowerCase().includes(lower)) return true;
      if (
        m.fields.some(
          (f) =>
            f.name.toLowerCase().includes(lower) ||
            f.type.toLowerCase().includes(lower)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [project.models, filterType, rootModels, subModels, searchTerm]);

  // Add new Model board
  const handleAddModelBoard = () => {
    const newBoard = createModelBoard(`Datenmodell ${modelBoards.length + 1}`);
    store.update((draft) => {
      draft.boards.push(newBoard);
    });
    store.setActiveBoard(newBoard.id);
    onShowToast?.(`✨ Neues Modell-Board "${newBoard.name}" angelegt!`);
  };

  const handleStartRenameBoard = (bId: string, currentName: string) => {
    setEditingBoardNameId(bId);
    setBoardNameDraft(currentName);
  };

  const handleSaveRenameBoard = (bId: string) => {
    const trimmed = boardNameDraft.trim();
    if (trimmed) {
      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === bId);
        if (b) b.name = trimmed;
      });
    }
    setEditingBoardNameId(null);
  };

  const handleDeleteModelBoard = (bId: string) => {
    if (modelBoards.length <= 1) return;
    store.update((draft) => {
      deleteBoard(draft, bId);
    });
    const remaining = modelBoards.filter((b) => b.id !== bId);
    if (remaining.length > 0) {
      store.setActiveBoard(remaining[0].id);
    }
    onShowToast?.('🗑️ Modell-Board gelöscht');
  };

  // Create new model
  const handleCreateModel = () => {
    const newModel = createModel(`NeuesModel${project.models.length + 1}`);
    const newNodeId = uid('n_');
    store.update((draft) => {
      draft.models.push(newModel);
      if (viewMode === 'canvas' && activeModelBoard) {
        const b = draft.boards.find((item) => item.id === activeModelBoard.id);
        if (b) {
          b.nodes.push({
            id: newNodeId,
            kind: 'model',
            modelId: newModel.id,
            position: { x: 300 + Math.random() * 80, y: 200 + Math.random() * 80 },
          });
        }
      }
    });
    onEditModel(newModel.id);
  };

  // Place model on current board
  const handlePlaceModelOnCanvas = (modelId: string) => {
    if (!activeModelBoard) return;
    const existing = activeModelBoard.nodes.find(
      (n) => n.kind === 'model' && n.modelId === modelId
    );
    if (existing) {
      onShowToast?.(`Model ist bereits auf dem Board platziert`);
      return;
    }
    const newNodeId = uid('n_');
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeModelBoard.id);
      if (b) {
        b.nodes.push({
          id: newNodeId,
          kind: 'model',
          modelId,
          position: { x: 350 + Math.random() * 80, y: 250 + Math.random() * 80 },
        });
      }
    });
    onShowToast?.(`✓ Model aufs Canvas platziert!`);
  };

  // Delete model handler with usage verification
  const handleDeleteModel = (model: Model) => {
    const usages = modelUsages(project, model.id);
    const isUsed =
      usages.boards.length > 0 ||
      usages.models.length > 0 ||
      usages.endpoints.length > 0;

    if (isUsed) {
      setDeleteConfirmation({
        model,
        usages: {
          boards: usages.boards.map((b) => b.name),
          models: usages.models.map((m) => m.name),
          endpoints: usages.endpoints.map((e) => `${e.method} ${e.path}`),
        },
      });
    } else {
      store.update((draft) => {
        deleteModel(draft, model.id);
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmation) return;
    store.update((draft) => {
      deleteModel(draft, deleteConfirmation.model.id);
    });
    setDeleteConfirmation(null);
  };

  // Expand / collapse all state in tree view
  const [expandedModelIds, setExpandedModelIds] = useState<Set<string>>(
    () => new Set(project.models.map((m) => m.id))
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleFocusModel = (name: string) => {
    const target = project.models.find((m) => m.name === name);
    if (!target) return;
    setExpandedModelIds((prev) => new Set(prev).add(target.id));
    if (viewMode !== 'tree') setViewMode('tree');
    setTimeout(() => {
      const el = document.getElementById(`model-card-${target.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-orange-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-orange-500'), 2000);
      }
    }, 50);
  };

  // ERD Nodes & Edges generation for Auto-Layout mode
  const { erdNodes, erdEdges } = useMemo(() => {
    let visibleModels = project.models;
    if (erdFilterModelId !== 'all') {
      const subtreeIds = collectSubtreeModelIds(
        project,
        erdFilterModelId,
        erdIncludeParents
      );
      visibleModels = project.models.filter((m) => subtreeIds.has(m.id));
    }

    const positions = computeErdLayout(visibleModels);
    const nodesList: Node[] = [];
    const edgesList: Edge[] = [];
    const modelMap = new Map(visibleModels.map((m) => [m.name, m]));

    visibleModels.forEach((m) => {
      const isRoot = rootModels.some((r) => r.id === m.id);
      const info = getModelHierarchyInfo(project, m.id);
      const pos = positions.get(m.id) || { x: 80, y: 80 };

      nodesList.push({
        id: m.id,
        type: 'erdModel',
        position: pos,
        data: {
          model: m,
          isRoot,
          parentNames: info.parentModels.map((p) => p.name),
          onEdit: () => onEditModel(m.id),
          onFocus: () =>
            setErdFilterModelId((curr) => (curr === m.id ? 'all' : m.id)),
          isFocused: erdFilterModelId === m.id,
        },
      });

      for (const field of m.fields) {
        const refs = referencedTypeNames(field.type);
        for (const refName of refs) {
          const target = modelMap.get(refName);
          if (target) {
            edgesList.push({
              id: `edge_${m.id}_${field.id}_${target.id}`,
              source: m.id,
              target: target.id,
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: 'smoothstep',
              zIndex: 10,
              label: field.name,
              animated: true,
              style: { stroke: '#f97316', strokeWidth: 2 },
              labelStyle: { fill: '#ea580c', fontSize: 11, fontWeight: 600 },
              labelBgStyle: {
                fill: theme === 'dark' ? '#0f172a' : '#ffffff',
                rx: 4,
                ry: 4,
              },
              labelBgPadding: [6, 3],
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#f97316',
                width: 16,
                height: 16,
              },
            });
          }
        }
      }
    });

    return { erdNodes: nodesList, erdEdges: edgesList };
  }, [
    project,
    rootModels,
    erdFilterModelId,
    erdIncludeParents,
    onEditModel,
    theme,
    layoutSeed,
  ]);

  const [erdNodesState, setErdNodesState, onErdNodesChange] = useNodesState(erdNodes);
  const [erdEdgesState, setErdEdgesState, onErdEdgesChange] = useEdgesState(erdEdges);

  useEffect(() => {
    setErdNodesState(erdNodes);
  }, [erdNodes, setErdNodesState]);

  useEffect(() => {
    setErdEdgesState(erdEdges);
  }, [erdEdges, setErdEdgesState]);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-slate-50 dark:bg-[#0b0f19] overflow-hidden select-none">
      {/* Top Header & View Controls */}
      <header className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 z-10 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Datenmodelle</span>
              <span className="px-2 py-0.2 rounded-full text-[11px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300">
                {project.models.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {rootModels.length} Hauptmodelle, {subModels.length} Untermodelle
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher: Freier Canvas vs Hierarchie-Baum vs Auto-Diagramm */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'canvas'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Freier interaktiver Modell-Canvas mit freier Platzierung und Beziehungen"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Freier Canvas</span>
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Hierarchische Baum- und Tabellenansicht mit Attributen"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>Hierarchie-Baum</span>
            </button>
            <button
              onClick={() => setViewMode('erd')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'erd'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Automatisches Modell-Diagramm (ERD)"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Auto-Layout</span>
            </button>
          </div>

          {/* PlantUML Export & Import */}
          {(onOpenPlantUmlExport || onOpenPlantUmlImport) && (
            <div className="flex items-center rounded-lg border border-purple-200 dark:border-purple-800/80 overflow-hidden shadow-sm">
              {onOpenPlantUmlExport && (
                <button
                  onClick={onOpenPlantUmlExport}
                  className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border-r border-purple-200 dark:border-purple-800/80"
                  title="Datenmodelle als PlantUML exportieren"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>PlantUML</span>
                </button>
              )}
              {onOpenPlantUmlImport && (
                <button
                  onClick={onOpenPlantUmlImport}
                  className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="PlantUML Importieren"
                >
                  <span>Import</span>
                </button>
              )}
            </div>
          )}

          {/* Java Export & Import */}
          {onOpenJavaModal && (
            <div className="flex items-center rounded-lg border border-amber-300 dark:border-amber-800/80 overflow-hidden shadow-sm">
              <button
                onClick={() => onOpenJavaModal('export')}
                className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border-r border-amber-200 dark:border-amber-800/80"
                title="Java Records & POJOs exportieren"
              >
                <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Java</span>
              </button>
              <button
                onClick={() => onOpenJavaModal('import')}
                className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Java Code importieren (Records & Klassen)"
              >
                <span>Import</span>
              </button>
            </div>
          )}

          {/* Local AI Assistant Integration */}
          {onOpenAiModal && (
            <button
              onClick={onOpenAiModal}
              className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-300 dark:border-purple-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Lokale KI (Open WebUI / Ollama) zur Datenmodellierung aufrufen"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>KI Modellierung</span>
            </button>
          )}

          {/* New Model Button */}
          <button
            onClick={handleCreateModel}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Neues Model</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      {viewMode === 'canvas' ? (
        /* ------------------------------------------------------------------- */
        /* MODE 1: FREIER MODELL-CANVAS                                        */
        /* ------------------------------------------------------------------- */
        <div className="flex-1 flex overflow-hidden relative">
          {/* Collapsible Left Model Explorer Sidebar */}
          <aside
            className={`${
              isSidebarOpen ? 'w-72' : 'w-0'
            } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 overflow-hidden z-10 shrink-0 select-none shadow-sm`}
          >
            {isSidebarOpen && (
              <div className="flex flex-col h-full w-72">
                {/* Explorer Header */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                      Modell-Bibliothek ({project.models.length})
                    </span>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    title="Sidebar zuklappen"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                {/* Search & Filter */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Modelle durchsuchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Alle ({project.models.length})
                    </button>
                    <button
                      onClick={() => setFilterType('root')}
                      className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                        filterType === 'root'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      Haupt ({rootModels.length})
                    </button>
                    <button
                      onClick={() => setFilterType('sub')}
                      className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                        filterType === 'sub'
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                      }`}
                    >
                      Sub ({subModels.length})
                    </button>
                  </div>
                </div>

                {/* Models List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1 py-0.5 flex items-center justify-between">
                    <span>Per Drag & Drop aufs Canvas ziehen:</span>
                    <span>{filteredModels.length}</span>
                  </div>

                  {filteredModels.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Keine Modelle gefunden
                    </div>
                  ) : (
                    filteredModels.map((m) => {
                      const isRoot = rootModels.some((r) => r.id === m.id);
                      const isOnBoard = activeModelBoard?.nodes.some(
                        (n) => n.kind === 'model' && n.modelId === m.id
                      );

                      return (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/eventflow',
                              JSON.stringify({
                                type: 'model',
                                id: m.id,
                                name: m.name,
                              })
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className={`p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing group ${
                            isOnBoard
                              ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50'
                              : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 hover:border-orange-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-orange-500 shrink-0" />
                              <Database
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isRoot ? 'text-blue-500' : 'text-orange-500'
                                }`}
                              />
                              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                                {m.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isOnBoard ? (
                                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-medium">
                                  Auf Canvas
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePlaceModelOnCanvas(m.id)}
                                  className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline px-1 py-0.5 rounded"
                                  title="Aufs Canvas platzieren"
                                >
                                  + Canvas
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onEditModel(m.id)}
                                className="p-1 text-slate-400 hover:text-orange-500"
                                title="Model bearbeiten"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-5">
                            <span>{m.fields.length} Felder</span>
                            <span>{isRoot ? 'Hauptmodell' : 'Untermodell'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Model Boards Switcher */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Modell-Boards ({modelBoards.length})</span>
                    <button
                      onClick={handleAddModelBoard}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-orange-600 rounded transition-colors"
                      title="Neues Modell-Board anlegen"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {modelBoards.map((mb) => {
                      const isActive = mb.id === activeModelBoard?.id;
                      return (
                        <div
                          key={mb.id}
                          onClick={() => store.setActiveBoard(mb.id)}
                          className={`px-2 py-1 rounded-md text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {editingBoardNameId === mb.id ? (
                            <input
                              type="text"
                              value={boardNameDraft}
                              onChange={(e) => setBoardNameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameBoard(mb.id);
                                if (e.key === 'Escape') setEditingBoardNameId(null);
                              }}
                              onBlur={() => handleSaveRenameBoard(mb.id)}
                              autoFocus
                              className="px-1 py-0.5 bg-white dark:bg-slate-900 border border-orange-400 rounded text-xs w-full"
                            />
                          ) : (
                            <>
                              <span className="truncate">{mb.name}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRenameBoard(mb.id, mb.name);
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                  title="Umbenennen"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                {modelBoards.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteModelBoard(mb.id);
                                    }}
                                    className="text-slate-400 hover:text-rose-500"
                                    title="Board löschen"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* Toggle sidebar button when collapsed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-20 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md text-slate-600 dark:text-slate-300 hover:text-orange-600 transition-colors"
              title="Modell-Explorer öffnen"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          {/* Canvas Area with ReactFlowProvider */}
          <main className="flex-1 h-full w-full relative bg-slate-100 dark:bg-[#0b0f19]">
            {activeModelBoard && (
              <ReactFlowProvider key={activeModelBoard.id}>
                <FreeModelCanvasInner
                  boardId={activeModelBoard.id}
                  onEditModel={onEditModel}
                  onShowToast={onShowToast}
                  onOpenJavaModal={onOpenJavaModal}
                  onOpenAiModal={onOpenAiModal}
                />
              </ReactFlowProvider>
            )}
          </main>
        </div>
      ) : viewMode === 'tree' ? (
        /* ------------------------------------------------------------------- */
        /* MODE 2: HIERARCHIE-BAUM                                             */
        /* ------------------------------------------------------------------- */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-header Filter & Search Bar */}
          <div className="px-6 py-3 bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Alle ({project.models.length})
              </button>
              <button
                onClick={() => setFilterType('root')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterType === 'root'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                }`}
              >
                Hauptmodelle ({rootModels.length})
              </button>
              <button
                onClick={() => setFilterType('sub')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterType === 'sub'
                    ? 'bg-orange-600 text-white font-semibold shadow-sm'
                    : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60'
                }`}
              >
                Untermodelle ({subModels.length})
              </button>

              <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

              <button
                onClick={() => setExpandedModelIds(new Set(project.models.map((m) => m.id)))}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Alle aufklappen
              </button>
              <span className="text-slate-400">•</span>
              <button
                onClick={() => setExpandedModelIds(new Set())}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Alle zuklappen
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Modelle oder Felder durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Model Cards Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredModels.length === 0 ? (
              <div className="text-center py-16">
                <Database className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Keine Datenmodelle gefunden
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                  {searchTerm
                    ? `Keine Suchergebnisse für "${searchTerm}".`
                    : 'Erstelle dein erstes Datenmodell, um es hier zu sehen.'}
                </p>
                <button
                  onClick={handleCreateModel}
                  className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Jetzt Model anlegen</span>
                </button>
              </div>
            ) : (
              filteredModels.map((model) => (
                <TreeModelCard
                  key={model.id}
                  model={model}
                  allModels={project.models}
                  visitedModelIds={new Set()}
                  expandedModelIds={expandedModelIds}
                  onToggleExpand={handleToggleExpand}
                  onEditModel={onEditModel}
                  onDeleteModel={handleDeleteModel}
                  onFocusModel={handleFocusModel}
                  onOpenInErd={(id) => {
                    setErdFilterModelId(id);
                    setViewMode('erd');
                  }}
                  onOpenJavaModal={onOpenJavaModal}
                  onShowToast={onShowToast}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------------- */
        /* MODE 3: AUTO-LAYOUT (ERD)                                           */
        /* ------------------------------------------------------------------- */
        <div className="flex-1 w-full h-full flex flex-col relative overflow-hidden">
          {/* ERD Control Bar */}
          <div className="px-6 py-2.5 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm z-10 shadow-xs transition-colors">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Filter className="w-3.5 h-3.5 text-orange-500" />
                <span>Modell-Fokus:</span>
              </div>

              <select
                value={erdFilterModelId}
                onChange={(e) => setErdFilterModelId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
              >
                <option value="all">Alle Modelle anzeigen ({project.models.length})</option>
                {rootModels.length > 0 && (
                  <optgroup label="Hauptmodelle">
                    {rootModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.fields.length} Felder)
                      </option>
                    ))}
                  </optgroup>
                )}
                {subModels.length > 0 && (
                  <optgroup label="Untermodelle (Sub-Modelle)">
                    {subModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.fields.length} Felder)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {erdFilterModelId !== 'all' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center gap-1.5 border border-orange-200 dark:border-orange-800/60">
                    <span>Fokus aktiv</span>
                    <button
                      onClick={() => setErdFilterModelId('all')}
                      className="hover:text-orange-950 dark:hover:text-white ml-1 font-bold p-0.5 hover:bg-orange-200 dark:hover:bg-orange-900 rounded"
                      title="Filter aufheben"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>

                  <button
                    onClick={() => setErdIncludeParents((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors ${
                      erdIncludeParents
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-semibold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Auch übergeordnete Modelle anzeigen"
                  >
                    <span>Eltern einbeziehen</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLayoutSeed((s) => s + 1)}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Karten automatisch neu berechnen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Neu berechnen</span>
              </button>

              <button
                onClick={() => setShowLegend((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                  showLegend
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border-transparent'
                }`}
                title="Legende umschalten"
              >
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                <span>Legende</span>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full relative">
            <ReactFlowProvider>
              <ReactFlow
                nodes={erdNodesState}
                edges={erdEdgesState}
                nodeTypes={erdNodeTypes}
                onNodesChange={onErdNodesChange}
                onEdgesChange={onErdEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                elevateEdgesOnSelect
                minZoom={0.15}
                maxZoom={2}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={16}
                  size={1}
                  color={theme === 'dark' ? '#334155' : '#cbd5e1'}
                />
                <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !shadow-md !rounded-lg" />
                <MiniMap
                  nodeColor={(n) => (n.data?.isRoot ? '#3b82f6' : '#f97316')}
                  className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !rounded-xl"
                />
              </ReactFlow>
            </ReactFlowProvider>

            {showLegend && (
              <div className="absolute bottom-6 left-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg text-xs space-y-1.5 pointer-events-none transition-all z-20">
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  <span>ERD-Legende</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Hauptmodell (Root)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>Untermodell (Sub-Modell)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="w-4 h-[2px] bg-orange-500" />
                  <span>Feld-Referenz</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Model &quot;{deleteConfirmation.model.name}&quot; löschen?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Dieses Model wird derzeit noch an folgenden Stellen im Projekt verwendet:
            </p>

            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto text-xs">
              {deleteConfirmation.usages.boards.length > 0 && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Auf Canvas-Boards:
                  </span>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {deleteConfirmation.usages.boards.join(', ')}
                  </div>
                </div>
              )}
              {deleteConfirmation.usages.models.length > 0 && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Als Untermodell in anderen Datenmodellen:
                  </span>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {deleteConfirmation.usages.models.join(', ')}
                  </div>
                </div>
              )}
              {deleteConfirmation.usages.endpoints.length > 0 && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    In API Endpoints:
                  </span>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {deleteConfirmation.usages.endpoints.join(', ')}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Trotzdem löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
