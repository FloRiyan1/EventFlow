import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Download,
  Upload,
  FileCode,
  Coffee,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { AlignmentMode } from '@eventflow/core';

export interface ContextMenuTarget {
  type: 'node' | 'pane' | 'edge';
  nodeId?: string;
  nodeKind?: string;
  modelId?: string;
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
  onOpenPlantUmlExport?: () => void;
  onOpenPlantUmlImport?: () => void;
  onOpenJavaModal?: (tab?: 'export' | 'import', modelId?: string) => void;
  onOpenAiModal?: () => void;
  onImportModelsToPage?: () => void;
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
  onOpenPlantUmlExport,
  onOpenPlantUmlImport,
  onOpenJavaModal,
  onOpenAiModal,
  onImportModelsToPage,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'export' | 'import' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track global mouse moves to calculate diagonal movement towards the submenu
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      prevMousePosRef.current = mousePosRef.current;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
  const menuHeight = target.type === 'node' ? 320 : target.type === 'pane' ? 380 : 220;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const posX = Math.min(x, screenW - menuWidth - 10);
  const posY = Math.min(y, screenH - menuHeight - 10);

  const openToLeft = posX + menuWidth + 230 > screenW;
  const openToTop = posY + 200 > screenH;
  const isSmallScreen = screenW < 520;

  const hasExportOptions = Boolean(onOpenPlantUmlExport || onOpenJavaModal);
  const hasImportOptions = Boolean(onOpenPlantUmlImport || onOpenJavaModal || onOpenAiModal);

  // Check if cursor is moving diagonally towards the open submenu
  const isMovingTowardsSubmenu = useCallback(() => {
    if (!submenuRef.current) return false;
    const rect = submenuRef.current.getBoundingClientRect();
    const curr = mousePosRef.current;
    const prev = prevMousePosRef.current;
    const dx = curr.x - prev.x;

    // Moving horizontally towards the submenu?
    const movingTowardsX = openToLeft ? dx < -0.3 : dx > 0.3;
    if (!movingTowardsX) return false;

    // Within vertical range of submenu (with generous buffer for diagonal movement)
    const buffer = 50;
    return curr.y >= rect.top - buffer && curr.y <= rect.bottom + buffer;
  }, [openToLeft]);

  const handleMouseEnterItem = useCallback(
    (key: 'export' | 'import') => {
      if (isSmallScreen) return;

      if (activeSubmenu === key) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      if (activeSubmenu && activeSubmenu !== key && isMovingTowardsSubmenu()) {
        // User is moving diagonally towards the existing active submenu
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setActiveSubmenu(key);
        }, 250);
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActiveSubmenu(key);
    },
    [activeSubmenu, isMovingTowardsSubmenu, isSmallScreen]
  );

  const handleMouseLeaveItem = useCallback(() => {
    if (isSmallScreen) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = isMovingTowardsSubmenu() ? 320 : 200;
    timerRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, delay);
  }, [isMovingTowardsSubmenu, isSmallScreen]);

  const handleMouseEnterSubmenu = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseEnterOther = useCallback(() => {
    if (isSmallScreen || !activeSubmenu) return;
    if (isMovingTowardsSubmenu()) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveSubmenu(null);
      }, 250);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 100);
  }, [activeSubmenu, isMovingTowardsSubmenu, isSmallScreen]);

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-[9999] w-60 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl py-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none divide-y divide-slate-100 dark:divide-slate-800/80 transition-colors"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Pane specific: Create New Items */}
      {target.type === 'pane' && (
        <div className="py-1" onMouseEnter={handleMouseEnterOther}>
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

          {onImportModelsToPage && (
            <button
              onClick={() => {
                onImportModelsToPage();
                onClose();
              }}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-200 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <span>Modelle auf Page importieren...</span>
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
        <div className="py-1" onMouseEnter={handleMouseEnterOther}>
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
      <div className="py-1" onMouseEnter={handleMouseEnterOther}>
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

      {/* Import & Export Sections */}
      {(hasExportOptions || hasImportOptions) && (
        <div className="py-1">
          {/* Oberpunkt: Export */}
          {hasExportOptions && (
            <div
              className="relative"
              onMouseEnter={() => handleMouseEnterItem('export')}
              onMouseLeave={handleMouseLeaveItem}
            >
              <button
                onClick={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  setActiveSubmenu((prev) => (prev === 'export' ? null : 'export'));
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors group ${
                  activeSubmenu === 'export'
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white'
                    : ''
                }`}
                title="Datenmodelle und Diagramme exportieren"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <span className="font-medium">Export</span>
                </div>
                {isSmallScreen ? (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      activeSubmenu === 'export' ? 'rotate-180' : ''
                    }`}
                  />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>

              {/* Desktop Flyout Submenu */}
              {!isSmallScreen && activeSubmenu === 'export' && (
                <div
                  ref={submenuRef}
                  onMouseEnter={handleMouseEnterSubmenu}
                  onMouseLeave={handleMouseLeaveItem}
                  className={`absolute ${openToTop ? 'bottom-0' : 'top-0'} ${
                    openToLeft
                      ? 'right-full mr-1.5 before:absolute before:-right-3 before:-top-6 before:-bottom-6 before:w-5 before:content-[""]'
                      : 'left-full ml-1.5 before:absolute before:-left-3 before:-top-6 before:-bottom-6 before:w-5 before:content-[""]'
                  } w-56 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 z-50`}
                >
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Exportieren als
                  </div>
                  {onOpenPlantUmlExport && (
                    <button
                      onClick={() => {
                        onOpenPlantUmlExport();
                        onClose();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <FileCode className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">PlantUML</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Diagramm (*.puml)</span>
                      </div>
                    </button>
                  )}
                  {onOpenJavaModal && (
                    <button
                      onClick={() => {
                        onOpenJavaModal('export', target.modelId);
                        onClose();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Coffee className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">Java Code</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Records & POJO Klassen</span>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Inline Expansion */}
              {isSmallScreen && activeSubmenu === 'export' && (
                <div className="bg-slate-50 dark:bg-slate-950/50 py-1 pl-4 border-l-2 border-blue-500/50 my-1 space-y-0.5">
                  {onOpenPlantUmlExport && (
                    <button
                      onClick={() => {
                        onOpenPlantUmlExport();
                        onClose();
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      <FileCode className="w-3.5 h-3.5 text-purple-500" />
                      <span>PlantUML (*.puml)</span>
                    </button>
                  )}
                  {onOpenJavaModal && (
                    <button
                      onClick={() => {
                        onOpenJavaModal('export', target.modelId);
                        onClose();
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300"
                    >
                      <Coffee className="w-3.5 h-3.5 text-amber-500" />
                      <span>Java Records & Klassen</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Oberpunkt: Import */}
          {hasImportOptions && (
            <div
              className="relative"
              onMouseEnter={() => handleMouseEnterItem('import')}
              onMouseLeave={handleMouseLeaveItem}
            >
              <button
                onClick={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  setActiveSubmenu((prev) => (prev === 'import' ? null : 'import'));
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors group ${
                  activeSubmenu === 'import'
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white'
                    : ''
                }`}
                title="Datenmodelle und Diagramme importieren"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span className="font-medium">Import</span>
                </div>
                {isSmallScreen ? (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      activeSubmenu === 'import' ? 'rotate-180' : ''
                    }`}
                  />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>

              {/* Desktop Flyout Submenu */}
              {!isSmallScreen && activeSubmenu === 'import' && (
                <div
                  ref={submenuRef}
                  onMouseEnter={handleMouseEnterSubmenu}
                  onMouseLeave={handleMouseLeaveItem}
                  className={`absolute ${openToTop ? 'bottom-0' : 'top-0'} ${
                    openToLeft
                      ? 'right-full mr-1.5 before:absolute before:-right-3 before:-top-6 before:-bottom-6 before:w-5 before:content-[""]'
                      : 'left-full ml-1.5 before:absolute before:-left-3 before:-top-6 before:-bottom-6 before:w-5 before:content-[""]'
                  } w-56 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 z-50`}
                >
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Importieren von
                  </div>
                  {onOpenPlantUmlImport && (
                    <button
                      onClick={() => {
                        onOpenPlantUmlImport();
                        onClose();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <FileCode className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">PlantUML</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">*.puml Datei oder Code</span>
                      </div>
                    </button>
                  )}
                  {onOpenJavaModal && (
                    <button
                      onClick={() => {
                        onOpenJavaModal('import');
                        onClose();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Coffee className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">Java Quellcode</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Records & Klassen (*.java)</span>
                      </div>
                    </button>
                  )}
                  {onOpenAiModal && (
                    <button
                      onClick={() => {
                        onOpenAiModal();
                        onClose();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                    >
                      <div className="w-6 h-6 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">KI-Assistent</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Lokale KI (Open WebUI)</span>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Inline Expansion */}
              {isSmallScreen && activeSubmenu === 'import' && (
                <div className="bg-slate-50 dark:bg-slate-950/50 py-1 pl-4 border-l-2 border-emerald-500/50 my-1 space-y-0.5">
                  {onOpenPlantUmlImport && (
                    <button
                      onClick={() => {
                        onOpenPlantUmlImport();
                        onClose();
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      <FileCode className="w-3.5 h-3.5 text-purple-500" />
                      <span>PlantUML Code / Datei</span>
                    </button>
                  )}
                  {onOpenJavaModal && (
                    <button
                      onClick={() => {
                        onOpenJavaModal('import');
                        onClose();
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs text-slate-700 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300"
                    >
                      <Coffee className="w-3.5 h-3.5 text-amber-500" />
                      <span>Java Quellcode</span>
                    </button>
                  )}
                  {onOpenAiModal && (
                    <button
                      onClick={() => {
                        onOpenAiModal();
                        onClose();
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>KI-Assistent (Open WebUI)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete action (Node only) */}
      {target.type === 'node' && target.nodeId && (
        <div className="py-1" onMouseEnter={handleMouseEnterOther}>
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
        <div className="py-1" onMouseEnter={handleMouseEnterOther}>
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
