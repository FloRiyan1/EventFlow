import { memo } from 'react';
import type { ChangeEvent } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useEditorStore } from '../storeContext';
import type { ShapeNode as ShapeNodeType } from '@eventflow/core';
import { Trash2 } from 'lucide-react';

interface Props {
  id: string;
  data: ShapeNodeType;
  selected?: boolean;
}

const SHAPE_PALETTE = [
  { label: 'Weiß / Hellgrau', fill: '#f8fafc', border: '#cbd5e1', darkFill: '#1e293b', darkBorder: '#475569' },
  { label: 'Gelb', fill: '#fef3c7', border: '#fcd34d', darkFill: '#78350f', darkBorder: '#b45309' },
  { label: 'Blau', fill: '#e0f2fe', border: '#7dd3fc', darkFill: '#0c4a6e', darkBorder: '#0284c7' },
  { label: 'Grün', fill: '#dcfce7', border: '#86efac', darkFill: '#064e3b', darkBorder: '#059669' },
  { label: 'Lila', fill: '#f3e8ff', border: '#d8b4fe', darkFill: '#581c87', darkBorder: '#9333ea' },
  { label: 'Rosa', fill: '#ffe4e6', border: '#fda4af', darkFill: '#881337', darkBorder: '#e11d48' },
  { label: 'Transparent', fill: 'transparent', border: '#94a3b8', darkFill: 'transparent', darkBorder: '#64748b' },
];

export const ShapeNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const shapeType = data.shapeType || 'rectangle';

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

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === id && n.kind === 'shape') as ShapeNodeType;
      if (node) node.label = val;
    });
  };

  const handleColorChange = (fill: string) => {
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === id && n.kind === 'shape') as ShapeNodeType;
      if (node) node.color = fill;
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

  const isText = shapeType === 'text';
  const isCircle = shapeType === 'circle';

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center transition-colors group ${
        isText
          ? 'bg-transparent'
          : isCircle
          ? 'rounded-full shadow-sm'
          : 'rounded-xl shadow-sm'
      } ${
        !isText && (data.color === 'transparent' ? 'border-2 border-dashed border-slate-400' : 'border border-slate-300 dark:border-slate-700')
      }`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: data.color || (isText ? 'transparent' : '#f8fafc'),
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={isText ? 100 : 80}
        minHeight={isText ? 40 : 80}
        color="#f97316"
        onResizeEnd={handleResizeEnd}
      />

      {/* Floating Toolbar when Selected */}
      {selected && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg px-2 py-1 rounded-lg flex items-center gap-1.5 z-30 nodrag nopan">
          <div className="flex items-center gap-1">
            {SHAPE_PALETTE.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleColorChange(p.fill)}
                className={`w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 transition-transform hover:scale-125 ${
                  data.color === p.fill ? 'ring-2 ring-orange-500 scale-110' : ''
                }`}
                style={{ backgroundColor: p.fill === 'transparent' ? '#ffffff' : p.fill }}
                title={p.label}
              />
            ))}
          </div>

          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={handleDelete}
            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
            title="Form löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Optional connection handles for shapes */}
      {!isText && (
        <>
          <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-orange-400 opacity-0 group-hover:opacity-100" />
          <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-orange-400 opacity-0 group-hover:opacity-100" />
          <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-orange-400 opacity-0 group-hover:opacity-100" />
          <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-orange-400 opacity-0 group-hover:opacity-100" />
        </>
      )}

      {/* Textarea inside shape / text node */}
      <textarea
        value={data.label || ''}
        onChange={handleTextChange}
        placeholder={isText ? 'Text eingeben...' : 'Beschriftung...'}
        className={`nodrag nopan w-full h-full bg-transparent resize-none outline-none font-medium text-center flex items-center justify-center p-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:italic ${
          isText ? 'font-bold' : ''
        }`}
        style={{
          fontSize: data.fontSize || (isText ? 18 : 14),
          lineHeight: '1.3',
        }}
      />
    </div>
  );
});

ShapeNode.displayName = 'ShapeNode';
