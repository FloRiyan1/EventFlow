import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { FlowRefNode as FlowRefNodeType } from '@eventflow/core';
import { Workflow, ExternalLink, ArrowRight } from 'lucide-react';
import { useStore, useEditorStore } from '../storeContext';

interface Props {
  id: string;
  data: FlowRefNodeType & { targetBoardName?: string };
  selected?: boolean;
}

export const FlowRefNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);

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

  const targetBoard = project.boards.find((b) => b.id === data.targetBoardId);
  const targetName = data.label || targetBoard?.name || data.targetBoardName || 'Flow';
  const nodeCount = targetBoard?.nodes.length ?? 0;

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetBoard) {
      store.setActiveBoard(targetBoard.id);
    }
  };

  return (
    <div
      onDoubleClick={handleNavigate}
      className={`relative w-full h-full min-w-[180px] min-h-[70px] rounded-xl shadow-lg dark:shadow-xl border flex flex-col justify-between bg-gradient-to-r from-purple-50 to-white dark:from-purple-950/90 dark:to-slate-900/90 backdrop-blur-md select-none group ${
        selected
          ? 'border-purple-500 ring-2 ring-purple-400/50'
          : 'border-purple-200 dark:border-purple-500/50 hover:border-purple-400'
      }`}
      style={{ width: '100%', height: '100%' }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={70}
        color="#a855f7"
        onResizeEnd={handleResizeEnd}
      />
      {/* Target input handle: other flows or elements can lead into this sub-flow */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-purple-600 !w-3 !h-3 !border-2 !border-white dark:!border-slate-900 shadow-sm"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-purple-600 !w-3 !h-3 !border-2 !border-white dark:!border-slate-900 shadow-sm"
      />

      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-500/30">
              <Workflow className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Einstiegspunkt / Sub-Flow
              </div>
              <div className="font-bold text-xs text-slate-850 dark:text-purple-100 truncate" title={targetName}>
                {targetName}
              </div>
            </div>
          </div>

          <button
            onClick={handleNavigate}
            title="Zu diesem Flow springen"
            className="p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-2.5 pt-2 border-t border-purple-200 dark:border-purple-500/20 flex items-center justify-between text-[10px] text-purple-700/80 dark:text-purple-300/80">
          <span>{nodeCount} Nodes im Flow</span>
          <span className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400 group-hover:text-purple-800 dark:group-hover:text-purple-300 font-medium">
            Öffnen <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Source output handle: flow can continue to screens or endpoints */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-purple-600 !w-3 !h-3 !border-2 !border-white dark:!border-slate-900 shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-purple-600 !w-3 !h-3 !border-2 !border-white dark:!border-slate-900 shadow-sm"
      />
    </div>
  );
});

FlowRefNode.displayName = 'FlowRefNode';
