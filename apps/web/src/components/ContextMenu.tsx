import React, { useEffect, useRef } from 'react';
import {
  Copy,
  ClipboardPaste,
  Files,
  Trash2,
  Edit,
  Sparkles,
  Globe,
  Database,
  MousePointerClick,
  FileText,
  Plus,
  Network,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
} from 'lucide-react';
import type { AlignmentMode } from '@eventflow/core';

export interface ContextMenuTarget {
  type: 'node' | 'pane' | 'edge';
  nodeId?: string;
  nodeKind?: string;
  edgeId?: string;
  position: { x: number; y: number }; // Flow coordinates (x, y)
  selectedCount?: number;
  hasSubModels?: boolean;
}

interface Props {
  x: number; // Screen clientX
  y: number; // Screen clientY
  target: ContextMenuTarget;
  onClose: () => void;
  onCopy: () => void;
  onPaste: (flowPos: { x: number; y: number }) => void;
  onDuplicate: (nodeId?: string) => void;
  onDelete: (nodeId?: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onEdit?: (nodeId: string) => void;
  onInsertSubModels?: (nodeId: string) => void;
  onCreateEndpoint?: (flowPos: { x: number; y: number }) => void;
  onCreateModel?: (flowPos: { x: number; y: number }) => void;
  onCreateUserAction?: (flowPos: { x: number; y: number }) => void;
  onCreateNote?: (flowPos: { x: number; y: number }) => void;
  onAlign?: (mode: AlignmentMode) => void;
  hasClipboardContent: boolean;
}

export const ContextMenu: React.FC<Props> = ({
  x,
  y,
  target,
  onClose,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onDeleteEdge,
  onEdit,
  onInsertSubModels,
  onCreateEndpoint,
  onCreateModel,
  onCreateUserAction,
  onCreateNote,
  onAlign,
  hasClipboardContent,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape key
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutside, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', handleOutside, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Adjust coordinates if menu would overflow screen
  const menuWidth = 240;
  const menuHeight = target.type === 'node' ? 240 : target.type === 'pane' ? 300 : 160;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const posX = Math.min(x, screenW - menuWidth - 10);
  const posY = Math.min(y, screenH - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-[9999] w-60 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl py-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none divide-y divide-slate-100 dark:divide-slate-800/80 transition-colors"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Pane specific: Create New Items */}
      {target.type === 'pane' && (
        <div className="py-1">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Neu erstellen
          </div>

          {onCreateEndpoint && (
            <button
              onClick={() => {
                onCreateEndpoint(target.position);
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <span>Neue API (Endpoint)</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {onCreateModel && (
            <button
              onClick={() => {
                onCreateModel(target.position);
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded bg-orange-500/10 text-orange-500 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <span>Neues Modell (Model)</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {onCreateUserAction && (
            <button
              onClick={() => {
                onCreateUserAction(target.position);
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <MousePointerClick className="w-3.5 h-3.5" />
                </div>
                <span>Neue Aktion (User Action)</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {onCreateNote && (
            <button
              onClick={() => {
                onCreateNote(target.position);
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span>Neue Notiz</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      )}

      {/* Node specific actions */}
      {target.type === 'node' && target.nodeId && (
        <div className="py-1">
          {onEdit && (
            <button
              onClick={() => {
                onEdit(target.nodeId!);
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Edit className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Bearbeiten</span>
              </div>
              <kbd className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                Doppelklick
              </kbd>
            </button>
          )}

          {target.nodeKind === 'model' && onInsertSubModels && target.hasSubModels && (
            <button
              onClick={() => {
                onInsertSubModels(target.nodeId!);
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-300 transition-colors font-semibold"
              title="Alle referenzierten Untermodelle auf diesem Canvas einfügen und automatisch verbinden"
            >
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-orange-500" />
                <span>Untermodelle einfügen & verbinden</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            </button>
          )}

          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>
                {target.selectedCount && target.selectedCount > 1
                  ? `${target.selectedCount} Elemente kopieren`
                  : 'Kopieren'}
              </span>
            </div>
            <kbd className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Strg+C
            </kbd>
          </button>

          <button
            onClick={() => {
              onDuplicate(target.nodeId);
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Files className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>
                {target.selectedCount && target.selectedCount > 1
                  ? `${target.selectedCount} Elemente duplizieren`
                  : 'Duplizieren'}
              </span>
            </div>
            <kbd className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Strg+D
            </kbd>
          </button>

          {target.selectedCount && target.selectedCount > 1 && onAlign && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                onClick={() => {
                  onAlign('centerH');
                  onClose();
                }}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Alle markierten Elemente an ihrer horizontalen Mitte ausrichten"
              >
                <div className="flex items-center gap-2">
                  <AlignHorizontalJustifyCenter className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Horizontal mittig ausrichten</span>
                </div>
              </button>
              <button
                onClick={() => {
                  onAlign('centerV');
                  onClose();
                }}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Alle markierten Elemente an ihrer vertikalen Mitte ausrichten"
              >
                <div className="flex items-center gap-2">
                  <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Vertikal mittig ausrichten</span>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {/* Paste actions (Always visible or enabled if something can be pasted) */}
      <div className="py-1">
        <button
          onClick={() => {
            onPaste(target.position);
            onClose();
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>
              {hasClipboardContent
                ? 'Einfügen'
                : 'Aus Zwischenablage / Bild einfügen'}
            </span>
          </div>
          <kbd className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            Strg+V
          </kbd>
        </button>
      </div>

      {/* Delete action (Node only) */}
      {target.type === 'node' && target.nodeId && (
        <div className="py-1">
          <button
            onClick={() => {
              onDelete(target.nodeId);
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>
                {target.selectedCount && target.selectedCount > 1
                  ? `${target.selectedCount} Elemente löschen`
                  : 'Löschen'}
              </span>
            </div>
            <kbd className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Entf
            </kbd>
          </button>
        </div>
      )}

      {/* Delete action (Edge only) */}
      {target.type === 'edge' && target.edgeId && (
        <div className="py-1">
          <button
            onClick={() => {
              onDeleteEdge?.(target.edgeId!);
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Verbindung löschen</span>
            </div>
            <kbd className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Entf
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
};
