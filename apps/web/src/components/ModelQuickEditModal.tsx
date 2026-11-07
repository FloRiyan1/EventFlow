import React, { useState, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  fieldsFromText,
  fieldsToText,
  ensureModelsForFields,
  referencedTypeNames,
  renameModel,
  sortModelFields,
} from '@eventflow/core';
import type { Model, FieldSortCriterion } from '@eventflow/core';
import { X, Check, Database, Sparkles, ArrowUpDown } from 'lucide-react';

interface Props {
  modelId: string | null;
  onClose: () => void;
}

export const ModelQuickEditModal: React.FC<Props> = ({ modelId, onClose }) => {
  const store = useEditorStore();
  const model = useStore((s) => (modelId ? s.project.models.find((m) => m.id === modelId) : null));

  const [name, setName] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (model) {
      setName(model.name);
      setText(fieldsToText(model.fields));
    }
  }, [model]);

  if (!modelId || !model) return null;

  const parsedFields = fieldsFromText(text, model.fields);

  const handleSortFields = (criterion: FieldSortCriterion) => {
    const currentProject = store.getState().project;
    const dummyModel: Model = {
      id: model.id,
      name: name || model.name,
      description: model.description || '',
      fields: [...parsedFields],
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
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">Model bearbeiten</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Passe den Model-Namen und die Felder im Fließtext an (Dart/Java-Syntax).
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
        <div className="p-6 space-y-4">
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
