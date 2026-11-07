import React, { useState, useRef, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import { uid } from '@eventflow/core';
import type { Hotspot, Rect, ScreenNode } from '@eventflow/core';
import { X, Plus, Trash2, Crosshair, Check } from 'lucide-react';

interface Props {
  nodeId: string | null;
  onClose: () => void;
}

export const HotspotEditorModal: React.FC<Props> = ({ nodeId, onClose }) => {
  const store = useEditorStore();
  const screenNode = useStore((s) => {
    if (!nodeId) return null;
    const board = s.project.boards.find((b) => b.id === s.activeBoardId);
    return board?.nodes.find((n) => n.id === nodeId && n.kind === 'screen') as ScreenNode | null;
  });

  const asset = useStore((s) => (screenNode ? s.project.assets[screenNode.assetId] : null));

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);

  // Set initial selected hotspot
  useEffect(() => {
    if (screenNode && screenNode.hotspots.length > 0 && !selectedHotspotId) {
      setSelectedHotspotId(screenNode.hotspots[0].id);
    }
  }, [screenNode, selectedHotspotId]);

  if (!nodeId || !screenNode || !asset) return null;

  const selectedHotspot = screenNode.hotspots.find((h) => h.id === selectedHotspotId);

  // Helper to calculate relative coordinate (0..1)
  const getRelativeCoord = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pos = getRelativeCoord(e);
    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart) return;
    const pos = getRelativeCoord(e);
    const x = Math.min(drawStart.x, pos.x);
    const y = Math.min(drawStart.y, pos.y);
    const w = Math.abs(pos.x - drawStart.x);
    const h = Math.abs(pos.y - drawStart.y);
    setCurrentRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);
    setDrawStart(null);

    // Only save if size is non-trivial (> 1.5% screen)
    if (currentRect.w > 0.015 && currentRect.h > 0.015) {
      const newHotspotId = uid('h_');
      const newHotspot: Hotspot = {
        id: newHotspotId,
        label: `Komponente ${screenNode.hotspots.length + 1}`,
        rect: currentRect,
        triggers: [
          {
            id: uid('t_'),
            event: 'onTap',
            condition: '',
          },
        ],
      };

      store.update((draft) => {
        const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
        const node = board?.nodes.find((n) => n.id === nodeId && n.kind === 'screen') as ScreenNode;
        if (node) node.hotspots.push(newHotspot);
      });

      setSelectedHotspotId(newHotspotId);
    }
    setCurrentRect(null);
  };

  const updateSelectedHotspot = (fn: (h: Hotspot) => void) => {
    if (!selectedHotspotId) return;
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === nodeId && n.kind === 'screen') as ScreenNode;
      const h = node?.hotspots.find((item) => item.id === selectedHotspotId);
      if (h) fn(h);
    });
  };

  const deleteSelectedHotspot = () => {
    if (!selectedHotspotId) return;
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === nodeId && n.kind === 'screen') as ScreenNode;
      if (node) {
        node.hotspots = node.hotspots.filter((h) => h.id !== selectedHotspotId);
      }
    });
    setSelectedHotspotId(null);
  };

  const addTriggerToHotspot = () => {
    updateSelectedHotspot((h) => {
      h.triggers.push({
        id: uid('t_'),
        event: 'onTap',
        condition: '',
      });
    });
  };

  const removeTrigger = (triggerId: string) => {
    updateSelectedHotspot((h) => {
      h.triggers = h.triggers.filter((t) => t.id !== triggerId);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Hotspot & Trigger Editor
                <span className="text-xs font-normal text-slate-600 dark:text-slate-400 px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">
                  {screenNode.title || 'Screen'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ziehe Rechtecke auf dem Screenshot auf, um klickbare Komponenten und Flow-Trigger zu definieren.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Canvas: Screen Image */}
          <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 flex items-center justify-center overflow-auto relative select-none">
            <div
              className="relative max-h-full max-w-full inline-block cursor-crosshair border border-slate-300 dark:border-slate-800 rounded-lg shadow-xl bg-white dark:bg-slate-900"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <img
                ref={imageRef}
                src={asset.dataUrl}
                alt="Screen Hotspot Editor"
                className="max-h-[70vh] object-contain rounded-lg pointer-events-none"
              />

              {/* Render Existing Hotspots */}
              {screenNode.hotspots.map((h) => {
                const isSelected = h.id === selectedHotspotId;
                return (
                  <div
                    key={h.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHotspotId(h.id);
                    }}
                    className={`absolute rounded cursor-pointer transition-all border-2 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/30 ring-2 ring-amber-400 shadow-lg z-10'
                        : 'border-amber-500/70 bg-amber-500/15 hover:bg-amber-400/25 z-0'
                    }`}
                    style={{
                      left: `${h.rect.x * 100}%`,
                      top: `${h.rect.y * 100}%`,
                      width: `${h.rect.w * 100}%`,
                      height: `${h.rect.h * 100}%`,
                    }}
                  >
                    <span
                      className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold shadow truncate max-w-[160px] ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/90 text-amber-300'
                      }`}
                    >
                      {h.label}
                    </span>
                  </div>
                );
              })}

              {/* Render Currently Drawing Rect */}
              {isDrawing && currentRect && (
                <div
                  className="absolute border-2 border-dashed border-amber-300 bg-amber-400/25 rounded pointer-events-none"
                  style={{
                    left: `${currentRect.x * 100}%`,
                    top: `${currentRect.y * 100}%`,
                    width: `${currentRect.w * 100}%`,
                    height: `${currentRect.h * 100}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Panel: Hotspot & Trigger configuration */}
          <div className="w-96 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                Hotspots ({screenNode.hotspots.length})
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400/90 font-medium">
                {selectedHotspot ? '1 ausgewählt' : 'Klicke auf Hotspot'}
              </span>
            </div>

            {selectedHotspot ? (
              <div className="mt-4 space-y-5 flex-1">
                {/* Hotspot Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">
                    Bezeichnung der Komponente
                  </label>
                  <input
                    type="text"
                    value={selectedHotspot.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateSelectedHotspot((h) => {
                        h.label = val;
                      });
                    }}
                    placeholder="z.B. Button Position erfassen"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400"
                  />
                </div>

                {/* Triggers Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Flow-Auslöser (Trigger)
                    </label>
                    <button
                      onClick={addTriggerToHotspot}
                      className="px-2 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Trigger
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {selectedHotspot.triggers.map((trigger, idx) => (
                      <div
                        key={trigger.id}
                        className="p-3 bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-400">Trigger #{idx + 1}</span>
                          {selectedHotspot.triggers.length > 1 && (
                            <button
                              onClick={() => removeTrigger(trigger.id)}
                              className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-1"
                              title="Trigger löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Event Selector */}
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Ereignis (Event)</label>
                          <select
                            value={trigger.event}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateSelectedHotspot((h) => {
                                const t = h.triggers.find((item) => item.id === trigger.id);
                                if (t) t.event = val;
                              });
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-amber-500 dark:focus:border-amber-400"
                          >
                            <option value="onTap">onTap (Tippen / Klick)</option>
                            <option value="onLongPress">onLongPress (Gedrückt halten)</option>
                            <option value="onSubmit">onSubmit (Absenden)</option>
                            <option value="onScan">onScan (Barcode / NFC)</option>
                            <option value="onChange">onChange (Wertänderung)</option>
                            <option value="onLoad">onLoad (Beim Laden)</option>
                          </select>
                        </div>

                        {/* Optional Condition */}
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Bedingung (optional)
                          </label>
                          <input
                            type="text"
                            value={trigger.condition}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateSelectedHotspot((h) => {
                                const t = h.triggers.find((item) => item.id === trigger.id);
                                if (t) t.condition = val;
                              });
                            }}
                            placeholder="z.B. unvollstaendig == true"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-amber-500 dark:focus:border-amber-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delete Hotspot Button */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={deleteSelectedHotspot}
                    className="w-full py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Hotspot löschen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 text-xs">
                <Crosshair className="w-8 h-8 mb-2 opacity-40" />
                <span>Klicke auf einen Hotspot im Bild oder ziehe einen neuen Rahmen auf.</span>
              </div>
            )}

            {/* Footer Done */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <Check className="w-4 h-4" /> Fertig & Übernehmen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
