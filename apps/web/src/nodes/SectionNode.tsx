import { memo, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { useEditorStore } from '../storeContext';
import type { SectionNode as SectionNodeType } from '@eventflow/core';
import { LayoutGrid, Trash2, Edit2, Check } from 'lucide-react';

interface Props {
  id: string;
  data: SectionNodeType;
  selected?: boolean;
}

const SECTION_COLORS = [
  { label: 'Blau', value: '#3b82f6', bg: 'bg-blue-500/10 dark:bg-blue-500/15', border: 'border-blue-400 dark:border-blue-500/60', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' },
  { label: 'Lila', value: '#8b5cf6', bg: 'bg-purple-500/10 dark:bg-purple-500/15', border: 'border-purple-400 dark:border-purple-500/60', text: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' },
  { label: 'Grün', value: '#10b981', bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', border: 'border-emerald-400 dark:border-emerald-500/60', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' },
  { label: 'Orange', value: '#f97316', bg: 'bg-orange-500/10 dark:bg-orange-500/15', border: 'border-orange-400 dark:border-orange-500/60', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300' },
  { label: 'Rot', value: '#ef4444', bg: 'bg-rose-500/10 dark:bg-rose-500/15', border: 'border-rose-400 dark:border-rose-500/60', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' },
  { label: 'Grau', value: '#64748b', bg: 'bg-slate-500/10 dark:bg-slate-500/15', border: 'border-slate-400 dark:border-slate-500/60', text: 'text-slate-600 dark:text-slate-400', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
];

export const SectionNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(data.label || 'Neuer Bereich');

  const activeColor = SECTION_COLORS.find((c) => c.value === data.color) ?? SECTION_COLORS[0];

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

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === store.getState().activeBoardId);
      const n = b?.nodes.find((item) => item.id === id && item.kind === 'section') as SectionNodeType;
      if (n) n.label = trimmed;
    });
  };

  const handleColorChange = (hex: string) => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === store.getState().activeBoardId);
      const n = b?.nodes.find((item) => item.id === id && item.kind === 'section') as SectionNodeType;
      if (n) n.color = hex;
    });
  };

  const handleDelete = () => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === store.getState().activeBoardId);
      if (b) {
        b.nodes = b.nodes.filter((item) => item.id !== id);
      }
    });
  };

  return (
    <div
      className={`relative w-full h-full rounded-2xl border-2 border-dashed transition-colors group select-none ${
        activeColor.border
      } ${activeColor.bg}`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 240,
        minHeight: 180,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={180}
        color={data.color || '#3b82f6'}
        onResizeEnd={handleResizeEnd}
      />

      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between gap-2 z-10 pointer-events-auto">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`p-1 rounded-md ${activeColor.badge} shrink-0`}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </div>

          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1 nodrag nopan">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                onBlur={handleSaveTitle}
                autoFocus
                className="px-2 py-0.5 rounded text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none w-full max-w-[200px]"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="p-1 text-emerald-600 hover:text-emerald-700 rounded"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              onDoubleClick={() => {
                setTitleDraft(data.label || 'Neuer Bereich');
                setIsEditingTitle(true);
              }}
              className="flex items-center gap-1.5 cursor-pointer group/title truncate"
              title="Doppelklick zum Umbenennen"
            >
              <span className={`text-xs font-bold truncate ${activeColor.text}`}>
                {data.label || 'Neuer Bereich'}
              </span>
              <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/title:opacity-70 transition-opacity shrink-0 text-slate-400" />
            </div>
          )}
        </div>

        {/* Color Palette & Actions (Visible on hover or when selected) */}
        <div className={`flex items-center gap-1 transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } nodrag nopan bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs`}>
          {SECTION_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => handleColorChange(c.value)}
              className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 ${
                data.color === c.value ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}

          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={handleDelete}
            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
            title="Bereich löschen"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Center Watermark Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-20">
        <span className={`text-2xl font-black uppercase tracking-widest ${activeColor.text}`}>
          {data.label || 'Bereich'}
        </span>
      </div>
    </div>
  );
});

SectionNode.displayName = 'SectionNode';
