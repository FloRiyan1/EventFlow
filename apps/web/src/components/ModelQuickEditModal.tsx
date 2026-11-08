import React, { useState, useEffect, useMemo } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  fieldsFromText,
  fieldsToText,
  ensureModelsForFields,
  referencedTypeNames,
  renameModel,
  sortModelFields,
  getDescendantModels,
  getInheritedFields,
} from '@eventflow/core';
import type { Model, FieldSortCriterion } from '@eventflow/core';
import { X, Check, Database, Sparkles, ArrowUpDown, GitFork } from 'lucide-react';

interface Props {
  modelId: string | null;
  onClose: () => void;
}

export const ModelQuickEditModal: React.FC<Props> = ({ modelId, onClose }) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const model = useStore((s) => (modelId ? s.project.models.find((m) => m.id === modelId) : null));

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [extendsModelId, setExtendsModelId] = useState<string | undefined>(model?.extendsModelId);
  const [isAbstract, setIsAbstract] = useState<boolean>(model?.isAbstract ?? false);

  useEffect(() => {
    if (model) {
      setName(model.name);
      setText(fieldsToText(model.fields));
      setExtendsModelId(model.extendsModelId);
      setIsAbstract(model.isAbstract ?? false);
    }
  }, [model]);

  const allModels = project.models;

  const descendantIds = useMemo(() => {
    if (!model) return new Set<string>();
    return new Set(getDescendantModels(project, model.id).map((m) => m.id));
  }, [project, model]);

  const candidateParents = useMemo(() => {
    if (!model) return [];
    return allModels.filter((m) => m.id !== model.id && !descendantIds.has(m.id));
  }, [allModels, model, descendantIds]);

  const parentModel = useMemo(() => {
    return extendsModelId ? allModels.find((m) => m.id === extendsModelId) : undefined;
  }, [allModels, extendsModelId]);

  const inheritedFields = useMemo(() => {
    if (!model || !extendsModelId) return [];
    return getInheritedFields(project, { ...model, extendsModelId });
  }, [project, model, extendsModelId]);

  if (!modelId || !model) return null;

  const parsedFields = fieldsFromText(text, model.fields);

  const handleSortFields = (criterion: FieldSortCriterion) => {
    const currentProject = store.getState().project;
    const dummyModel: Model = {
      id: model.id,
      name: name || model.name,
      description: model.description || '',
      fields: [...parsedFields],
      extendsModelId,
      isAbstract,
    };
    sortModelFields(currentProject, dummyModel, criterion);
    setText(fieldsToText(dummyModel.fields));
  };

  // Check referenced models
  const allReferenced = [
    ...new Set(parsedFields.flatMap((f) => referencedTypeNames(f.type))),
  ];

  const handleSave = () => {
    store.update((draft) => {
      // Handle rename if needed
      if (name.trim() && name.trim() !== model.name) {
        renameModel(draft, model.id, name.trim());
      }
      const targetModel = draft.models.find((m) => m.id === model.id);
      if (targetModel) {
        targetModel.fields = parsedFields;
        targetModel.extendsModelId = extendsModelId || undefined;
        targetModel.isAbstract = isAbstract;
      }
      // Auto-create missing models
      ensureModelsForFields(draft, parsedFields);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Model bearbeiten
                {isAbstract && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold">
                    «abstract»
                  </span>
                )}
                {parentModel && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 font-semibold flex items-center gap-1">
                    <GitFork className="w-3 h-3" /> extends {parentModel.name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Passe den Model-Namen, Vererbung und die Felder im Fließtext an.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Model Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. TaetigkeitPositionRESTModel"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-orange-600 dark:text-orange-300 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400"
            />
          </div>

          {/* Inheritance & Abstract Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1 flex items-center gap-1">
                <GitFork className="w-3.5 h-3.5 text-violet-500" /> Erbt von Basismodell (extends)
              </label>
              <select
                value={extendsModelId || ''}
                onChange={(e) => setExtendsModelId(e.target.value || undefined)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-violet-500"
              >
                <option value="">(Keine Vererbung)</option>
                {candidateParents.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} {pm.isAbstract ? '(«abstract»)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer select-none hover:border-purple-400 transition-colors">
                <input
                  type="checkbox"
                  checked={isAbstract}
                  onChange={(e) => setIsAbstract(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Abstraktes Modell (isAbstract)
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Wird als abstrakte Klasse exportiert
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Inherited Fields Preview */}
          {parentModel && (
            <div className="p-3 bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-violet-800 dark:text-violet-300">
                <span className="flex items-center gap-1">
                  <GitFork className="w-3.5 h-3.5" /> Geerbte Felder von {parentModel.name}
                </span>
                <span className="text-[11px] font-normal text-violet-600 dark:text-violet-400">
                  {inheritedFields.length} {inheritedFields.length === 1 ? 'Feld' : 'Felder'} geerbt
                </span>
              </div>
              {inheritedFields.length > 0 ? (
                <div className="flex flex-wrap gap-1 font-mono text-[11px] pt-0.5">
                  {inheritedFields.map((f) => (
                    <span
                      key={f.id}
                      className="px-2 py-0.5 bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 rounded border border-violet-200 dark:border-violet-800 shadow-xs"
                      title={`Geerbtes Feld: ${f.name} (${f.type})`}
                    >
                      <span className="text-violet-500 font-semibold">{f.type}</span>
                      {f.nullable ? '?' : ''} {f.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Das Basismodell {parentModel.name} hat aktuell keine Felder.
                </p>
              )}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400">
                Felder ({parsedFields.length} erkannt)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mr-0.5 flex items-center gap-0.5">
                  <ArrowUpDown className="w-3 h-3" /> Sortieren:
                </span>
                <button
                  type="button"
                  onClick={() => handleSortFields('name-asc')}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Alphabetisch aufsteigend sortieren"
                >
                  A–Z
                </button>
                <button
                  type="button"
                  onClick={() => handleSortFields('name-desc')}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Alphabetisch absteigend sortieren"
                >
                  Z–A
                </button>
                <button
                  type="button"
                  onClick={() => handleSortFields('type-asc')}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Nach Datentyp sortieren"
                >
                  Typ
                </button>
                <button
                  type="button"
                  onClick={() => handleSortFields('required-first')}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Pflichtfelder zuerst"
                >
                  Pflicht
                </button>
                <button
                  type="button"
                  onClick={() => handleSortFields('submodels-first')}
                  className="px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Untermodelle zuerst"
                >
                  Sub-Modelle
                </button>
              </div>
            </div>
            <textarea
              rows={11}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`String uuid\nString? nummer\nList<PositionRESTModel> positionen\ndouble? preis\nbool hasErfassungen`}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 leading-relaxed"
            />
          </div>

          {/* Reference Hints */}
          {allReferenced.length > 0 && (
            <div className="p-3 bg-orange-50/70 dark:bg-slate-950/70 border border-orange-200 dark:border-slate-800 rounded-lg flex items-start gap-2 text-xs">
              <Sparkles className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Verknüpfte Models: </span>
                <span className="text-orange-600 dark:text-orange-300 font-semibold">{allReferenced.join(', ')}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Fehlende referenzierte Models werden automatisch in der Projekt-Registry angelegt.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Check className="w-4 h-4" /> Speichern
          </button>
        </div>
      </div>
    </div>
  );
};
