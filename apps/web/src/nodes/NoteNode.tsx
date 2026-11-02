import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useEditorStore } from '../storeContext';
import type { NoteNode as NoteNodeType } from '@eventflow/core';
import { FileText } from 'lucide-react';

interface Props {
  id: string;
  data: NoteNodeType;
  selected?: boolean;
}

export const NoteNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();

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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === id && n.kind === 'note') as NoteNodeType;
      if (node) node.text = val;
    });
  };

  return (
    <div
      className={`relative w-full h-full min-w-[140px] min-h-[90px] p-2.5 rounded-lg shadow-md border flex flex-col ${
        selected
          ? 'border-amber-500 ring-2 ring-amber-400'
          : 'border-amber-200 dark:border-slate-600 hover:border-amber-400 dark:hover:border-slate-500'
      } bg-amber-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 text-xs backdrop-blur-sm group`}
      style={{ width: '100%', height: '100%' }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={90}
        color="#f59e0b"
        onResizeEnd={handleResizeEnd}
      />
      <Handle type="target" position={Position.Left} className="!bg-amber-400 dark:!bg-slate-400 !w-2.5 !h-2.5" />
      <Handle type="target" position={Position.Top} className="!bg-amber-400 dark:!bg-slate-400 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-1.5 pb-1 border-b border-amber-200/60 dark:border-slate-700 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
        <FileText className="w-3.5 h-3.5" />
        <span>Notiz</span>
      </div>

      <textarea
        value={data.text || ''}
        onChange={handleTextChange}
        placeholder="Notiz eingeben..."
        className="nodrag nopan w-full flex-1 min-h-0 mt-1.5 bg-transparent resize-none outline-none font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:italic"
      />

      <Handle type="source" position={Position.Right} className="!bg-amber-400 dark:!bg-slate-400 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 dark:!bg-slate-400 !w-2.5 !h-2.5" />
    </div>
  );
});

NoteNode.displayName = 'NoteNode';
