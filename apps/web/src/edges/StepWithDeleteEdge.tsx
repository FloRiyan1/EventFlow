import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';

export const StepWithDeleteEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  label,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0, // Crisp 90-degree orthogonal line
  });

  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('eventflow:delete-edge', {
        detail: { edgeId: id },
      })
    );
  };

  const isHighlighted = selected || isHovered;

  return (
    <>
      {/* Invisible thicker interaction stroke to make clicking and hovering very easy */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Visible Edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#38bdf8' : isHovered ? '#60a5fa' : style.stroke,
          strokeWidth: selected ? 3 : isHovered ? 2.5 : style.strokeWidth || 2,
          filter: selected ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.7))' : undefined,
          transition: 'stroke 0.15s, stroke-width 0.15s, filter 0.15s',
        }}
      />

      {/* Center Label & Delete Button */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1.5 z-30"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {label && (
            <div className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/80 shadow backdrop-blur-md pointer-events-none select-none">
              {label}
            </div>
          )}

          {/* Delete Button shown when hovered or selected */}
          {isHighlighted && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-5 h-5 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-150 hover:scale-125 border border-rose-300/40 cursor-pointer"
              title="Verbindung löschen"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
