import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useEditorStore } from '../storeContext';
import type { UserActionNode as UserActionNodeType } from '@eventflow/core';
import { MousePointerClick } from 'lucide-react';

interface Props {
  id: string;
  data: UserActionNodeType;
  selected?: boolean;
}

export const UserActionNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const [isEditing, setIsEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');

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
    setLabelDraft(data.label || 'User Action');
  }, [data.label]);

  const handleSave = () => {
    const trimmed = labelDraft.trim();
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === store.getState().activeBoardId);
      const node = board?.nodes.find((n) => n.id === id && n.kind === 'userAction') as UserActionNodeType;
      if (node) node.label = trimmed || 'User Action';
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`relative w-full h-full min-w-[100px] min-h-[36px] px-3.5 py-2 rounded-full shadow-lg transition-all duration-200 border flex items-center justify-center gap-2 ${
        selected ? 'border-white ring-2 ring-amber-400' : 'border-amber-400 hover:border-amber-300'
      } bg-[#FFC21A] text-slate-950 font-bold text-xs tracking-tight select-none`}
      style={{ width: '100%', height: '100%' }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={36}
        color="#FFC21A"
        onResizeEnd={handleResizeEnd}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-slate-950 !w-2.5 !h-2.5 !border-2 !border-white"
      />

      <MousePointerClick className="w-3.5 h-3.5 shrink-0 opacity-80" />

      {isEditing ? (
        <input
          type="text"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setLabelDraft(data.label || 'User Action');
              setIsEditing(false);
            }
          }}
          onBlur={handleSave}
          autoFocus
          className="nodrag nopan px-1.5 py-0.5 bg-white text-slate-950 rounded text-xs font-bold outline-none ring-1 ring-slate-950 w-28 text-center"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className="truncate cursor-pointer hover:underline"
          title="Klicken zum Umbenennen"
        >
          {data.label || 'User Action'}
        </span>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-slate-950 !w-2.5 !h-2.5 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-slate-950 !w-2.5 !h-2.5 !border-2 !border-white"
      />
    </div>
  );
});

UserActionNode.displayName = 'UserActionNode';
