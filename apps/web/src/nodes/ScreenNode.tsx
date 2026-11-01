import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore, useEditorStore } from '../storeContext';
import { triggerHandleId } from '@eventflow/core';
import type { ScreenNode as ScreenNodeType } from '@eventflow/core';
import { Smartphone, Target, Maximize2, Edit2 } from 'lucide-react';

interface Props {
  id: string;
  data: ScreenNodeType;
  selected?: boolean;
}

export const ScreenNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const asset = useStore((s) => s.project.assets[data.assetId]);

  // Title inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

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

  useEffect(() => {
    setTitleDraft(data.title || 'Figma Screen');
  }, [data.title]);

  const openHotspotEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('eventflow:open-hotspots', { detail: { nodeId: id } }));
  };

  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim();
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === id && n.kind === 'screen') as ScreenNodeType;
      if (node) node.title = trimmed || 'Figma Screen';
    });
    setIsEditingTitle(false);
  };

  return (
    <div
      className={`relative rounded-xl shadow-xl transition-all duration-200 border ${
        selected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-500'
      } bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 w-full h-full min-w-[160px] min-h-[200px] flex flex-col overflow-hidden transition-colors`}
      style={{ width: '100%', height: '100%' }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={200}
        color="#f59e0b"
        onResizeEnd={handleResizeEnd}
      />
      {/* Target handle on Left for incoming navigation */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-950 !-left-1.5"
        title="Eingehende Screen-Navigation"
      />

      {/* Top Header */}
      <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-t-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1">
          <Smartphone className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
          {isEditingTitle ? (
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setTitleDraft(data.title || 'Figma Screen');
                  setIsEditingTitle(false);
                }
              }}
              onBlur={handleSaveTitle}
              autoFocus
              className="nodrag nopan px-1.5 py-0.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded text-xs font-semibold w-full outline-none ring-2 ring-amber-400 shadow-sm"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              className="font-semibold text-xs truncate text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 px-1 py-0.5 rounded transition-colors"
              title="Klicken zum Umbenennen"
            >
              {data.title || 'Figma Screen'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setIsEditingTitle(!isEditingTitle)}
            title="Screen-Titel bearbeiten"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 rounded transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openHotspotEditor}
            title="Hotspots im Bild zeichnen (Modal)"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 rounded transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Screen Image with Hotspots Overlay */}
      <div
        className="relative bg-slate-100 dark:bg-slate-900 group cursor-pointer overflow-hidden rounded-b-xl flex-1 flex flex-col min-h-0"
        onDoubleClick={openHotspotEditor}
      >
        {asset?.dataUrl ? (
          <img
            src={asset.dataUrl}
            alt={data.title || 'Screen'}
            className="w-full h-full flex-1 block object-cover select-none pointer-events-none"
          />
        ) : (
          <div className="h-full flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-400 dark:text-slate-500">
            <Smartphone className="w-8 h-8 mb-2 opacity-30" />
            <span>Kein Bild verfügbar</span>
          </div>
        )}

        {/* Visual Hotspot Rectangles Over Image - Arrow starts directly here! */}
        {(data.hotspots || []).map((h) => {
          const triggers = Array.isArray(h.triggers) ? h.triggers : [];
          const primaryTrigger = triggers[0] ?? { id: `t_${h.id}`, event: 'onTap', condition: '' };
          const rect = h.rect || { x: 0.1, y: 0.1, w: 0.8, h: 0.1 };
          return (
            <div
              key={h.id}
              title={`${h.label || 'Hotspot'} (${triggers.map((t) => t.event).join(', ') || 'onTap'})`}
              className="absolute border-2 border-amber-400 bg-amber-400/25 hover:bg-amber-400/40 rounded transition-all shadow-sm group/hs pointer-events-auto"
              style={{
                left: `${(rect.x ?? 0) * 100}%`,
                top: `${(rect.y ?? 0) * 100}%`,
                width: `${(rect.w ?? 0.2) * 100}%`,
                height: `${(rect.h ?? 0.1) * 100}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                openHotspotEditor(e);
              }}
            >
              {/* Hotspot Label Badge */}
              <span className="absolute -top-4 left-0 text-[9px] font-bold bg-amber-500 text-slate-950 px-1 rounded shadow truncate max-w-[140px] pointer-events-none select-none">
                {h.label || 'Hotspot'}
              </span>

              {/* Primary Trigger Handle: Line originates directly from this hotspot! */}
              <Handle
                id={triggerHandleId(primaryTrigger.id)}
                type="source"
                position={Position.Right}
                className="!bg-amber-400 !w-3 !h-3 !border-2 !border-slate-950 !-right-1.5 opacity-90 group-hover/hs:opacity-100 hover:!scale-150 transition-all cursor-crosshair shadow-md"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                title={`Von "${h.label || 'Hotspot'}" zu API ziehen`}
              />

              {/* Handles for any other triggers on this hotspot */}
              {triggers.slice(1).map((trigger) => (
                <Handle
                  key={trigger.id}
                  id={triggerHandleId(trigger.id)}
                  type="source"
                  position={Position.Right}
                  className="!bg-amber-400 !w-3 !h-3 !border-2 !border-slate-950 !-right-1.5 opacity-90 group-hover/hs:opacity-100 hover:!scale-150 transition-all cursor-crosshair shadow-md"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  title={`Von "${h.label || 'Hotspot'}" (${trigger.event}) zu API ziehen`}
                />
              ))}

              {/* Hotspot ID Handle alias for backwards compatibility */}
              <Handle
                id={`hs-${h.id}`}
                type="source"
                position={Position.Right}
                className="!bg-amber-400 !w-3 !h-3 !border-2 !border-slate-950 !-right-1.5 opacity-0 pointer-events-none"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                title={`Von "${h.label || 'Hotspot'}" zu API ziehen`}
              />
            </div>
          );
        })}

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-slate-950/20 dark:bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <span className="px-2.5 py-1 bg-white/95 dark:bg-slate-900/90 text-amber-700 dark:text-amber-300 text-xs rounded-md shadow border border-amber-400/40 dark:border-amber-500/30 flex items-center gap-1.5 font-medium">
            <Maximize2 className="w-3 h-3" /> Doppelklick für Hotspots
          </span>
        </div>
      </div>

      {/* Target handle on Top */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-slate-400 !w-2.5 !h-2.5"
      />
      {/* Source handle on Bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-amber-500 !w-2.5 !h-2.5"
      />
      {/* General Source handle on Right */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-amber-400 !w-2.5 !h-2.5 !border-2 !border-slate-950 !-right-1.5 opacity-60 hover:opacity-100"
      />
    </div>
  );
});

ScreenNode.displayName = 'ScreenNode';
