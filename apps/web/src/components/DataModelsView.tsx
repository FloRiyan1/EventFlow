import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
} from '@xyflow/react';
import { useStore, useEditorStore } from '../storeContext';
import {
  createModel,
  deleteModel,
  modelUsages,
  getModelHierarchyInfo,
  insertModelWithSubModels,
  referencedTypeNames,
  reorderModelField,
  sortModelFields,
  uid,
  type Model,
  type Field,
  type FieldSortCriterion,
  type Project,
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
  Maximize2,
} from 'lucide-react';
import { useTheme } from '../themeContext';

interface DataModelsViewProps {
  onEditModel: (modelId: string) => void;
  onOpenPlantUmlExport?: () => void;
  onOpenPlantUmlImport?: () => void;
  onShowToast?: (msg: string) => void;
}

// Custom Node for the ERD Canvas mode
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
          ? `✨ "${model.name}" und ${count - 1} Untermodelle aufs Flow-Board eingefügt!`
          : `✓ "${model.name}" aufs Flow-Board eingefügt!`
      );
    }
  };

  // New field inline creation state
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

  // Track visited to prevent infinite loop on circular model hierarchies
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
            title="Dieses Model auf dem aktuellen Flow-Board platzieren"
          >
            <Workflow className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Aufs Board</span>
          </button>

          {hierarchy.subModels.length > 0 && (
            <button
              onClick={() => handleInsertToBoard(true)}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60 border border-orange-300 dark:border-orange-800/60 flex items-center gap-1 transition-colors"
              title={`"${model.name}" inklusive aller ${hierarchy.subModels.length} Untermodelle auf dem aktuellen Flow-Board platzieren`}
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

// Estimate model node height dynamically based on field count
function estimateModelHeight(m: Model): number {
  const count = Math.min(m.fields.length, 12);
  return 100 + Math.max(1, count) * 26;
}

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

// Layered, collision-free layout for ERD nodes
function computeErdLayout(models: Model[]): Map<string, { x: number; y: number }> {
  const modelMap = new Map(models.map((m) => [m.name, m]));
  const idMap = new Map(models.map((m) => [m.id, m]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  models.forEach((m) => {
    outgoing.set(m.id, []);
    incoming.set(m.id, []);
  });

  models.forEach((m) => {
    for (const f of m.fields) {
      for (const refName of referencedTypeNames(f.type)) {
        const target = modelMap.get(refName);
        if (target && !outgoing.get(m.id)!.includes(target.id)) {
          outgoing.get(m.id)!.push(target.id);
          incoming.get(target.id)!.push(m.id);
        }
      }
    }
  });

  // Find weakly connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const m of models) {
    if (visited.has(m.id)) continue;
    const comp: string[] = [];
    const queue = [m.id];
    visited.add(m.id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      const neighbors = [...outgoing.get(curr)!, ...incoming.get(curr)!];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    components.push(comp);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const nodeWidth = 280;
  const nodeGapX = 90;
  const layerGapY = 130;
  const compGapX = 140;

  let currentCompStartX = 80;
  let currentCompStartY = 80;
  let maxRowHeight = 0;

  for (const compNodeIds of components) {
    const compModels = compNodeIds.map((id) => idMap.get(id)!);
    let compRoots = compModels.filter(
      (m) => incoming.get(m.id)!.filter((id) => compNodeIds.includes(id)).length === 0
    );
    if (compRoots.length === 0) compRoots = [compModels[0]];

    const layers = new Map<string, number>();
    compRoots.forEach((r) => layers.set(r.id, 0));

    let queue = [...compRoots.map((r) => r.id)];
    const visitedInComp = new Set(queue);

    while (queue.length > 0) {
      const u = queue.shift()!;
      const uLayer = layers.get(u) || 0;
      for (const v of outgoing.get(u)!) {
        if (!compNodeIds.includes(v)) continue;
        const currentVLayer = layers.get(v) || 0;
        if (uLayer + 1 > currentVLayer) {
          layers.set(v, uLayer + 1);
        }
        if (!visitedInComp.has(v)) {
          visitedInComp.add(v);
          queue.push(v);
        }
      }
    }

    compModels.forEach((m) => {
      if (!layers.has(m.id)) layers.set(m.id, 0);
    });

    const layerGroups = new Map<number, Model[]>();
    compModels.forEach((m) => {
      const l = layers.get(m.id)!;
      if (!layerGroups.has(l)) layerGroups.set(l, []);
      layerGroups.get(l)!.push(m);
    });

    const maxLayer = Math.max(...Array.from(layerGroups.keys()));

    const layerY = new Map<number, number>();
    let compHeight = 0;
    let currY = currentCompStartY;
    for (let l = 0; l <= maxLayer; l++) {
      layerY.set(l, currY);
      const group = layerGroups.get(l) || [];
      const maxHeightInLayer = Math.max(
        ...group.map((m) => estimateModelHeight(m)),
        140
      );
      currY += maxHeightInLayer + layerGapY;
      compHeight = currY - currentCompStartY;
    }

    let maxNodesInLayer = 1;
    for (let l = 0; l <= maxLayer; l++) {
      const count = (layerGroups.get(l) || []).length;
      if (count > maxNodesInLayer) maxNodesInLayer = count;
    }

    const compTotalWidth = maxNodesInLayer * nodeWidth + (maxNodesInLayer - 1) * nodeGapX;

    // Wrap to next component row if canvas gets excessively wide
    if (currentCompStartX + compTotalWidth > 2600 && currentCompStartX > 80) {
      currentCompStartX = 80;
      currentCompStartY += maxRowHeight + 140;
      maxRowHeight = 0;
      let recalcY = currentCompStartY;
      for (let l = 0; l <= maxLayer; l++) {
        layerY.set(l, recalcY);
        const group = layerGroups.get(l) || [];
        const maxHeightInLayer = Math.max(
          ...group.map((m) => estimateModelHeight(m)),
          140
        );
        recalcY += maxHeightInLayer + layerGapY;
      }
    }

    if (compHeight > maxRowHeight) {
      maxRowHeight = compHeight;
    }

    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups.get(l) || [];
      const layerTotalWidth = group.length * nodeWidth + (group.length - 1) * nodeGapX;
      const layerOffset = (compTotalWidth - layerTotalWidth) / 2;

      group.forEach((m, idx) => {
        const x = currentCompStartX + layerOffset + idx * (nodeWidth + nodeGapX);
        const y = layerY.get(l)!;
        positions.set(m.id, { x: Math.round(x), y: Math.round(y) });
      });
    }

    currentCompStartX += compTotalWidth + compGapX;
  }

  // Safety collision check pass
  const entries = Array.from(positions.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [idA, posA] = entries[i];
      const [idB, posB] = entries[j];
      const modelA = idMap.get(idA)!;
      const modelB = idMap.get(idB)!;
      const hA = estimateModelHeight(modelA);
      const hB = estimateModelHeight(modelB);

      const overlapX = Math.abs(posA.x - posB.x) < nodeWidth + 40;
      const overlapY = Math.abs(posA.y - posB.y) < Math.max(hA, hB) + 40;

      if (overlapX && overlapY) {
        posB.x = posA.x + nodeWidth + nodeGapX;
        positions.set(idB, posB);
      }
    }
  }

  return positions;
}

interface ErdCanvasInnerProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  theme: string;
  erdFilterModelId: string | 'all';
  erdIncludeParents: boolean;
  onResetLayout: () => void;
  showLegend: boolean;
  onToggleLegend: () => void;
  allModels: Model[];
  rootModels: Model[];
  subModels: Model[];
  onSelectFilter: (id: string | 'all') => void;
  onToggleIncludeParents: () => void;
}

const ErdCanvasInner: React.FC<ErdCanvasInnerProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  theme,
  erdFilterModelId,
  erdIncludeParents,
  onResetLayout,
  showLegend,
  onToggleLegend,
  allModels,
  rootModels,
  subModels,
  onSelectFilter,
  onToggleIncludeParents,
}) => {
  const { fitView } = useReactFlow();

  // Auto-fit when filter or nodes change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 60);
    return () => clearTimeout(timer);
  }, [erdFilterModelId, erdIncludeParents, nodes.length, fitView]);

  const focusedModel = useMemo(
    () => allModels.find((m) => m.id === erdFilterModelId),
    [allModels, erdFilterModelId]
  );

  return (
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
            onChange={(e) => onSelectFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
          >
            <option value="all">Alle Modelle anzeigen ({allModels.length})</option>
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

          {erdFilterModelId !== 'all' && focusedModel && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center gap-1.5 border border-orange-200 dark:border-orange-800/60">
                <span>
                  Fokus: <strong>{focusedModel.name}</strong> ({nodes.length} Modelle im Diagramm)
                </span>
                <button
                  onClick={() => onSelectFilter('all')}
                  className="hover:text-orange-950 dark:hover:text-white ml-1 font-bold p-0.5 hover:bg-orange-200 dark:hover:bg-orange-900 rounded"
                  title="Filter aufheben und alle Modelle anzeigen"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>

              <button
                onClick={onToggleIncludeParents}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors ${
                  erdIncludeParents
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Auch übergeordnete Modelle anzeigen, die dieses Modell referenzieren"
              >
                <span>Eltern einbeziehen</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fitView({ padding: 0.25, duration: 300 })}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Diagramm an Fenstergröße anpassen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Zentrieren</span>
          </button>

          <button
            onClick={onResetLayout}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Karten automatisch und kollisionsfrei neu anordnen"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Neu anordnen</span>
          </button>

          <button
            onClick={onToggleLegend}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              showLegend
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border-transparent'
            }`}
            title="ERD-Legende anzeigen oder verbergen"
          >
            <Layers className="w-3.5 h-3.5 text-orange-500" />
            <span>Legende</span>
          </button>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={erdNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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

        {/* Collapsible Floating Legend positioned at bottom-left */}
        {showLegend && (
          <div className="absolute bottom-6 left-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg text-xs space-y-1.5 pointer-events-none transition-all">
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
              <span>Feld-Referenz (mit Pfeil)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const DataModelsView: React.FC<DataModelsViewProps> = ({
  onEditModel,
  onOpenPlantUmlExport,
  onOpenPlantUmlImport,
  onShowToast,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const { theme } = useTheme();

  // Mode: 'tree' (Hierarchischer Baum) vs 'erd' (Visuelles ERD Canvas)
  const [viewMode, setViewMode] = useState<'tree' | 'erd'>('tree');

  // Filter: 'all' | 'root' | 'sub'
  const [filterType, setFilterType] = useState<'all' | 'root' | 'sub'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // ERD View model filter state
  const [erdFilterModelId, setErdFilterModelId] = useState<string | 'all'>('all');
  const [erdIncludeParents, setErdIncludeParents] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [layoutSeed, setLayoutSeed] = useState(0);

  const handleResetLayout = useCallback(() => {
    setLayoutSeed((s) => s + 1);
  }, []);

  // Expand / collapse all state in tree view
  const [expandedModelIds, setExpandedModelIds] = useState<Set<string>>(
    () => new Set(project.models.map((m) => m.id))
  );

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

  // Filtered models for display
  const filteredModels = useMemo(() => {
    return project.models.filter((m) => {
      // Type filter
      if (filterType === 'root' && !rootModels.some((r) => r.id === m.id)) return false;
      if (filterType === 'sub' && !subModels.some((s) => s.id === m.id)) return false;

      // Search term
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      if (m.name.toLowerCase().includes(lower)) return true;
      if (m.fields.some((f) => f.name.toLowerCase().includes(lower) || f.type.toLowerCase().includes(lower))) {
        return true;
      }
      return false;
    });
  }, [project.models, filterType, rootModels, subModels, searchTerm]);

  // Toggle single expand
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

  // Expand / collapse all
  const handleExpandAll = () => {
    setExpandedModelIds(new Set(project.models.map((m) => m.id)));
  };

  const handleCollapseAll = () => {
    setExpandedModelIds(new Set());
  };

  // Create new model
  const handleCreateModel = () => {
    const newModel = createModel(`NeuesModel${project.models.length + 1}`);
    store.update((draft) => {
      draft.models.push(newModel);
    });
    setExpandedModelIds((prev) => new Set(prev).add(newModel.id));
    onEditModel(newModel.id);
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

  // Jump to model card
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

  // ---------------------------------------------------------------------------
  // ERD Mode Canvas Nodes & Edges Generation
  // ---------------------------------------------------------------------------
  const { erdNodes, erdEdges } = useMemo(() => {
    let visibleModels = project.models;
    if (erdFilterModelId !== 'all') {
      const subtreeIds = collectSubtreeModelIds(project, erdFilterModelId, erdIncludeParents);
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

      // Directed edges only between visible models
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
              pathOptions: { borderRadius: 12 },
              zIndex: 10,
              label: field.name,
              animated: true,
              style: { stroke: '#f97316', strokeWidth: 2 },
              labelStyle: { fill: '#ea580c', fontSize: 11, fontWeight: 600 },
              labelBgStyle: { fill: theme === 'dark' ? '#0f172a' : '#ffffff', rx: 4, ry: 4 },
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

  const [nodes, setNodes, onNodesChange] = useNodesState(erdNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(erdEdges);

  // Synchronize state when computed erdNodes / erdEdges change
  useEffect(() => {
    setNodes(erdNodes);
  }, [erdNodes, setNodes]);

  useEffect(() => {
    setEdges(erdEdges);
  }, [erdEdges, setEdges]);

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-slate-50 dark:bg-[#0b0f19] overflow-hidden select-none">
      {/* Top Header & Controls */}
      <header className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 z-10 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Datenmodelle & Sub-Modelle</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300">
                {project.models.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {rootModels.length} Hauptmodelle, {subModels.length} Untermodelle (Sub-Modelle)
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher: Tree vs ERD Canvas */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
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
            >
              <Network className="w-3.5 h-3.5" />
              <span>Modell-Diagramm</span>
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

      {/* Main Body */}
      {viewMode === 'tree' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-header Filter & Search Bar */}
          <div className="px-6 py-3 bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter Pills */}
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

              {/* Expand / Collapse All */}
              <button
                onClick={handleExpandAll}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                Alle aufklappen
              </button>
              <span className="text-slate-400">•</span>
              <button
                onClick={handleCollapseAll}
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
                  onShowToast={onShowToast}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* Mode: ERD React Flow Canvas */
        <ReactFlowProvider>
          <ErdCanvasInner
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            theme={theme}
            erdFilterModelId={erdFilterModelId}
            erdIncludeParents={erdIncludeParents}
            onResetLayout={handleResetLayout}
            showLegend={showLegend}
            onToggleLegend={() => setShowLegend((prev) => !prev)}
            allModels={project.models}
            rootModels={rootModels}
            subModels={subModels}
            onSelectFilter={setErdFilterModelId}
            onToggleIncludeParents={() => setErdIncludeParents((prev) => !prev)}
          />
        </ReactFlowProvider>
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
