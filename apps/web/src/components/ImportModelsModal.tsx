import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Database,
  CheckSquare,
  Square,
  Upload,
  Check,
} from 'lucide-react';
import type { Model } from '@eventflow/core';

interface ImportModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
  projectModels: Model[];
  existingModelIds: Set<string>;
  onImportModels: (modelIds: string[]) => void;
}

export const ImportModelsModal: React.FC<ImportModelsModalProps> = ({
  isOpen,
  onClose,
  boardName,
  projectModels,
  existingModelIds,
  onImportModels,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Available models that can still be imported
  const availableModels = useMemo(() => {
    return projectModels.filter((m) => !existingModelIds.has(m.id));
  }, [projectModels, existingModelIds]);

  // Filtered models by search term
  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) return projectModels;
    const lower = searchTerm.toLowerCase();
    return projectModels.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.fields.some(
          (f) =>
            f.name.toLowerCase().includes(lower) ||
            f.type.toLowerCase().includes(lower)
        )
    );
  }, [projectModels, searchTerm]);

  const toggleSelect = (modelId: string) => {
    if (existingModelIds.has(modelId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleSelectAllAvailable = () => {
    const next = new Set(selectedIds);
    for (const m of availableModels) {
      next.add(m.id);
    }
    setSelectedIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) return;
    onImportModels(Array.from(selectedIds));
    setSelectedIds(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/15 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl border border-orange-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Modelle auf Page importieren
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800/60">
                  {boardName}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Wähle bestehende Datenmodelle aus dem Projekt aus, um sie auf dieser Page zu platzieren.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Bulk Action Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Modellname oder Felder filtern..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
              autoFocus
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

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>
                {availableModels.length} verfügbar zum Importieren
              </span>
              <span>•</span>
              <span>{existingModelIds.size} bereits auf dieser Page</span>
            </div>
            {availableModels.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllAvailable}
                  className="text-orange-600 dark:text-orange-400 hover:underline font-medium text-[11px]"
                >
                  Alle verfügbaren auswählen
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-slate-500 hover:underline text-[11px]"
                    >
                      Auswahl aufheben
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Model List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px]">
          {filteredModels.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              Keine passenden Modelle gefunden
            </div>
          ) : (
            filteredModels.map((m) => {
              const isAlreadyOnBoard = existingModelIds.has(m.id);
              const isSelected = selectedIds.has(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => !isAlreadyOnBoard && toggleSelect(m.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    isAlreadyOnBoard
                      ? 'bg-slate-50/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-orange-500/10 dark:bg-orange-950/40 border-orange-500/50 cursor-pointer shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-500/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-orange-500 shrink-0">
                      {isAlreadyOnBoard ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : isSelected ? (
                        <CheckSquare className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {m.fields.length} Felder
                          {m.fields.length > 0
                            ? ` (${m.fields.map((f) => f.name).slice(0, 3).join(', ')}${
                                m.fields.length > 3 ? '...' : ''
                              })`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isAlreadyOnBoard ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        Bereits auf Page
                      </span>
                    ) : isSelected ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500 text-white shadow-xs">
                        Wird importiert
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800">
                        Klicken zum Wählen
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {selectedIds.size > 0 ? (
              <span className="text-orange-600 dark:text-orange-400 font-semibold">
                {selectedIds.size} Modell{selectedIds.size === 1 ? '' : 'e'} ausgewählt
              </span>
            ) : (
              <span>Wähle Modelle zum Importieren aus</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                selectedIds.size > 0
                  ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-orange-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {selectedIds.size > 0
                  ? `${selectedIds.size} Modell${selectedIds.size === 1 ? '' : 'e'} auf Page importieren`
                  : 'Auf Page importieren'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
