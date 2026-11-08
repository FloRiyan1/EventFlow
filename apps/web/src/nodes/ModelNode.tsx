import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore, useEditorStore } from '../storeContext';
import type { ModelNode as ModelNodeType, Model, Field, FieldSortCriterion } from '@eventflow/core';
import {
  fieldsFromText,
  ensureModelsForFields,
  reorderModelField,
  sortModelFields,
  getInheritedFields,
  formatModelDeclaration,
  applyModelDeclaration,
} from '@eventflow/core';
import {
  Database,
  Plus,
  Trash2,
  Check,
  X,
  Edit2,
  Code2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  GitFork,
} from 'lucide-react';

interface Props {
  id: string;
  data: ModelNodeType & { model?: Model; fields?: Model['fields'] };
  selected?: boolean;
}

export const ModelNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const storeModel = useStore((s) => s.project.models.find((m) => m.id === data.modelId));
  const model = data.model ?? storeModel;

  const parentModel = model?.extendsModelId
    ? project.models.find((m) => m.id === model.extendsModelId)
    : null;
  const inheritedFields = model && model.extendsModelId ? getInheritedFields(project, model) : [];

  // Name inline editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Field inline editing
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldDraftType, setFieldDraftType] = useState('String');
  const [fieldDraftName, setFieldDraftName] = useState('');
  const [fieldDraftNullable, setFieldDraftNullable] = useState(false);

  // New field input
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldRaw, setNewFieldRaw] = useState('');
  const newFieldInputRef = useRef<HTMLInputElement>(null);

  // Field Reordering and Sorting menu
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const handleResizeEnd = (_: unknown, params: { x: number; y: number; width: number; height: number }) => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === store.getState().activeBoardId);
      const n = b?.nodes.find((item) => item.id === id);
      if (n) {
        n.width = Math.round(params.width);
        n.height = Math.round(params.height);
        n.position = { x: Math.round(params.x), y: Math.round(params.y) };
      }
    });
  };

  const currentDeclaration = model ? formatModelDeclaration(model, parentModel?.name) : '';

  const handleStartEditName = () => {
    setNameDraft(currentDeclaration);
    setIsEditingName(true);
  };

  useEffect(() => {
    if (model && !isEditingName) {
      setNameDraft(currentDeclaration);
    }
  }, [model?.name, model?.isAbstract, model?.extendsModelId, parentModel?.name, isEditingName, currentDeclaration]);

  useEffect(() => {
    if (isAddingField) {
      newFieldInputRef.current?.focus();
    }
  }, [isAddingField]);

  if (!model) {
    return (
      <div className="px-4 py-2 bg-red-950/80 border border-red-500 text-red-200 rounded-md text-xs">
        Model wurde gelöscht
      </div>
    );
  }

  // Name save / cancel (supports e.g. "Customer extends AbstractBase" or "abstract Customer")
  const handleSaveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== currentDeclaration) {
      store.update((draft) => {
        const m = draft.models.find((item) => item.id === model.id);
        if (m) {
          applyModelDeclaration(draft, m, trimmed);
        }
      });
    } else {
      setNameDraft(currentDeclaration);
    }
    setIsEditingName(false);
  };

  // Add field
  const handleAddField = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = newFieldRaw.trim();
    if (!raw) {
      setIsAddingField(false);
      return;
    }
    const textToParse = raw.includes(' ') ? raw : `String ${raw}`;
    const parsed = fieldsFromText(textToParse, []);
    if (parsed.length > 0) {
      store.update((draft) => {
        const m = draft.models.find((item) => item.id === model.id);
        if (m) {
          m.fields.push(parsed[0]);
          ensureModelsForFields(draft, m.fields);
        }
      });
      setNewFieldRaw('');
      setIsAddingField(false);
    }
  };

  // Delete field
  const handleDeleteField = (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.update((draft) => {
      const m = draft.models.find((item) => item.id === model.id);
      if (m) {
        m.fields = m.fields.filter((f) => f.id !== fieldId);
      }
      for (const b of draft.boards) {
        b.edges = b.edges.filter(
          (edge) =>
            edge.sourceHandle !== `field-out-${fieldId}` &&
            edge.targetHandle !== `field-in-${fieldId}`
        );
      }
    });
  };

  // Start field edit
  const handleStartEditField = (field: Field, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFieldId(field.id);
    setFieldDraftType(field.type);
    setFieldDraftName(field.name);
    setFieldDraftNullable(field.nullable);
  };

  // Save field edit
  const handleSaveFieldEdit = () => {
    if (!editingFieldId) return;
    const trimmedName = fieldDraftName.trim();
    if (trimmedName) {
      store.update((draft) => {
        const m = draft.models.find((item) => item.id === model.id);
        if (m) {
          const f = m.fields.find((item) => item.id === editingFieldId);
          if (f) {
            f.type = fieldDraftType.trim() || 'String';
            f.name = trimmedName;
            f.nullable = fieldDraftNullable;
            ensureModelsForFields(draft, m.fields);
          }
        }
      });
    }
    setEditingFieldId(null);
  };

  // Open modal fallback
  const openModalEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('eventflow:edit-model', { detail: { modelId: data.modelId } }));
  };

  // Field Reordering and Sorting

  const handleMoveField = (index: number, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    store.update((draft) => {
      const m = draft.models.find((item) => item.id === model.id);
      if (m) {
        reorderModelField(m, index, index + delta);
      }
    });
  };

  const handleSort = (criterion: FieldSortCriterion, e: React.MouseEvent) => {
    e.stopPropagation();
    store.update((draft) => {
      const m = draft.models.find((item) => item.id === model.id);
      if (m) {
        sortModelFields(draft, m, criterion);
      }
    });
    setIsSortMenuOpen(false);
  };

  return (
    <div
      className={`relative w-full h-full min-w-[200px] min-h-[80px] rounded-lg shadow-lg dark:shadow-xl border flex flex-col ${
        selected ? 'border-orange-500 ring-2 ring-orange-400' : 'border-orange-300 dark:border-orange-500/60 hover:border-orange-500'
      } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 group`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={80}
        color="#FF9F1C"
        onResizeEnd={handleResizeEnd}
      />
      {/* Target handle on Top */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-white !w-3 !h-3 !border-2 !border-orange-500 shadow-sm"
      />
      {/* Target handle on Left */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-white !w-3 !h-3 !border-2 !border-orange-500 shadow-sm"
      />

      {/* Header with orange banner */}
      <div className="p-2.5 bg-[#FF9F1C] text-slate-950 flex items-center justify-between font-bold text-sm tracking-tight border-b border-orange-600/30 rounded-t-lg">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1">
          <Database className="w-4 h-4 opacity-80 shrink-0" />
          {isEditingName ? (
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setNameDraft(currentDeclaration);
                  setIsEditingName(false);
                }
              }}
              onBlur={handleSaveName}
              autoFocus
              placeholder="z.B. A extends AbstractA"
              className="nodrag nopan px-1.5 py-0.5 bg-white text-slate-900 rounded text-xs font-bold w-full outline-none ring-2 ring-slate-900 shadow-sm"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                onClick={handleStartEditName}
                className="truncate cursor-pointer hover:bg-black/10 px-1 py-0.5 rounded transition-colors"
                title="Klicken zum Bearbeiten (unterstützt z.B. 'A extends AbstractA')"
              >
                {model.name}
              </span>
              {model.isAbstract && (
                <span className="text-[10px] bg-slate-950/70 text-white px-1.5 py-0.2 rounded font-mono font-normal shrink-0 tracking-tight">
                  «abstract»
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSortMenuOpen(!isSortMenuOpen);
              }}
              title="Felder sortieren"
              className="p-1 hover:bg-black/10 rounded text-slate-900 opacity-60 hover:opacity-100 transition-opacity"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            {isSortMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 text-xs nodrag nopan font-sans"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Felder sortieren
                </div>
                <button
                  onClick={(e) => handleSort('name-asc', e)}
                  className="w-full px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Name (A – Z)
                </button>
                <button
                  onClick={(e) => handleSort('name-desc', e)}
                  className="w-full px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Name (Z – A)
                </button>
                <button
                  onClick={(e) => handleSort('type-asc', e)}
                  className="w-full px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Nach Datentyp
                </button>
                <button
                  onClick={(e) => handleSort('required-first', e)}
                  className="w-full px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Pflichtfelder zuerst
                </button>
                <button
                  onClick={(e) => handleSort('submodels-first', e)}
                  className="w-full px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Untermodelle zuerst
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => (isEditingName ? handleSaveName() : handleStartEditName())}
            title="Name inline umbenennen / bearbeiten"
            className="p-1 hover:bg-black/10 rounded text-slate-900 opacity-60 hover:opacity-100 transition-opacity"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openModalEditor}
            title="Erweiterten Text-Editor öffnen"
            className="p-1 hover:bg-black/10 rounded text-slate-900 opacity-50 hover:opacity-100 transition-opacity"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Extends subheader */}
      {parentModel && (
        <div className="px-2.5 py-1 bg-violet-50 dark:bg-violet-950/40 border-b border-violet-200 dark:border-violet-900/50 flex items-center justify-between text-[11px] text-violet-700 dark:text-violet-300 font-sans">
          <span className="flex items-center gap-1 font-semibold truncate" title={`Erbt von ${parentModel.name}`}>
            <GitFork className="w-3 h-3 shrink-0" />
            <span className="truncate">extends {parentModel.name}</span>
          </span>
          <span className="text-[10px] text-violet-500 font-mono shrink-0 ml-1">
            ({inheritedFields.length} geerbt)
          </span>
        </div>
      )}

      {/* Fields (updated immediately when model changes) */}
      <div className="p-2.5 text-xs font-mono space-y-1 bg-white dark:bg-slate-900 flex-1 overflow-y-auto rounded-b-lg border-t border-orange-200 dark:border-orange-950/40">
        {/* Inherited Fields Section */}
        {inheritedFields.length > 0 && (
          <div className="mb-2 pb-1.5 border-b border-violet-200 dark:border-violet-900/60 space-y-0.5">
            <div className="text-[10px] font-sans font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1 px-1">
              <GitFork className="w-2.5 h-2.5" /> Geerbt von {parentModel?.name}
            </div>
            {inheritedFields.map((field) => (
              <div
                key={`inherited_${field.id}`}
                className="flex items-center justify-between gap-1 leading-tight px-1.5 py-0.5 text-slate-400 dark:text-slate-500 select-none"
                title={`Geerbtes Feld: ${field.name} (${field.type})`}
              >
                <div className="truncate flex-1">
                  <span className="text-violet-600/70 dark:text-violet-400/70 font-semibold">{field.type}</span>
                  {field.nullable && <span className="font-bold">?</span>}{' '}
                  <span className="italic">{field.name}</span>
                </div>
                <span className="text-[9px] font-sans text-violet-600/70 dark:text-violet-400/70 bg-violet-100/50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 rounded px-1">
                  geerbt
                </span>
              </div>
            ))}
          </div>
        )}

        {(model.fields || []).length === 0 && inheritedFields.length === 0 && !isAddingField ? (
          <div className="text-slate-400 dark:text-slate-500 italic text-[11px] py-1 text-center">
            Keine Felder vorhanden
          </div>
        ) : (
          (model.fields || []).map((field, idx, arr) => {
            const isEditingThisField = editingFieldId === field.id;

            if (isEditingThisField) {
              return (
                <div
                  key={field.id}
                  className="p-1.5 bg-orange-50 dark:bg-slate-800 rounded border border-orange-300 dark:border-orange-600 space-y-1 nodrag nopan"
                >
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={fieldDraftType}
                      onChange={(e) => setFieldDraftType(e.target.value)}
                      placeholder="Typ (z.B. String)"
                      className="w-1/2 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] text-orange-600 dark:text-orange-300 outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      value={fieldDraftName}
                      onChange={(e) => setFieldDraftName(e.target.value)}
                      placeholder="Name"
                      className="w-1/2 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fieldDraftNullable}
                        onChange={(e) => setFieldDraftNullable(e.target.checked)}
                        className="rounded text-orange-500 focus:ring-0 w-3 h-3"
                      />
                      Optional (?)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSaveFieldEdit}
                        className="p-0.5 bg-orange-500 text-slate-950 rounded hover:bg-orange-400 transition-colors"
                        title="Speichern"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                      <button
                        onClick={() => setEditingFieldId(null)}
                        className="p-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 transition-colors"
                        title="Abbrechen"
                      >
                        <X className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className="relative flex items-center justify-between gap-1 leading-tight px-1.5 py-1 rounded hover:bg-orange-50 dark:hover:bg-slate-800/60 group/row"
              >
                {/* Row Target Handle */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`field-in-${field.id}`}
                  className="!bg-white !w-2.5 !h-2.5 !border-2 !border-orange-500 !-left-2 opacity-35 group-hover/row:opacity-100 transition-opacity shadow-sm"
                  title={`Zu Feld: ${field.name}`}
                />

                <div
                  onClick={(e) => handleStartEditField(field, e)}
                  className="truncate flex-1 cursor-pointer select-none"
                  title="Klicken zum Bearbeiten"
                >
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">{field.type}</span>
                  {field.nullable && <span className="text-amber-600 dark:text-yellow-400 font-bold">?</span>}{' '}
                  <span className="text-slate-800 dark:text-slate-200">{field.name}</span>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button
                    disabled={idx === 0}
                    onClick={(e) => handleMoveField(idx, -1, e)}
                    className="p-0.5 text-slate-400 hover:text-orange-500 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                    title="Nach oben verschieben"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    disabled={idx === arr.length - 1}
                    onClick={(e) => handleMoveField(idx, 1, e)}
                    className="p-0.5 text-slate-400 hover:text-orange-500 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                    title="Nach unten verschieben"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleStartEditField(field, e)}
                    className="p-0.5 text-slate-400 hover:text-orange-500 transition-colors"
                    title="Feld bearbeiten"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteField(field.id, e)}
                    className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                    title="Feld löschen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Row Source Handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`field-out-${field.id}`}
                  className="!bg-white !w-2.5 !h-2.5 !border-2 !border-orange-500 !-right-2 opacity-35 group-hover/row:opacity-100 transition-opacity shadow-sm"
                  title={`Von Feld: ${field.name}`}
                />
              </div>
            );
          })
        )}

        {/* Inline Add Field Row */}
        {isAddingField ? (
          <form onSubmit={handleAddField} className="pt-1 nodrag nopan">
            <div className="flex items-center gap-1 bg-orange-50 dark:bg-slate-800/80 p-1.5 rounded border border-orange-300 dark:border-orange-600/60">
              <input
                ref={newFieldInputRef}
                type="text"
                value={newFieldRaw}
                onChange={(e) => setNewFieldRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsAddingField(false);
                }}
                placeholder="z.B. String? titel"
                className="flex-1 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] text-slate-900 dark:text-slate-100 outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="px-2 py-0.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-[10px] rounded transition-colors"
                title="Hinzufügen"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setIsAddingField(false)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Abbrechen"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-1.5">
            <button
              onClick={() => setIsAddingField(true)}
              className="w-full py-1 px-2 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Feld hinzufügen
            </button>
          </div>
        )}
      </div>

      {/* Source handle on Bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-white !w-3 !h-3 !border-2 !border-orange-500"
      />
      {/* Source handle on Right */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-white !w-3 !h-3 !border-2 !border-orange-500"
      />
    </div>
  );
});

ModelNode.displayName = 'ModelNode';
