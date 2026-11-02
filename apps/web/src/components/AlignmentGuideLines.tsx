import React from 'react';
import { useViewport } from '@xyflow/react';
import type { AlignmentGuideLine } from '@eventflow/core';

interface Props {
  verticalLine: AlignmentGuideLine | null;
  horizontalLine: AlignmentGuideLine | null;
}

export const AlignmentGuideLines: React.FC<Props> = ({ verticalLine, horizontalLine }) => {
  const { x, y, zoom } = useViewport();

  if (!verticalLine && !horizontalLine) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
      style={{ filter: 'drop-shadow(0 0 2px rgba(99, 102, 241, 0.5))' }}
    >
      <defs>
        <linearGradient id="guideGradV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
          <stop offset="20%" stopColor="#6366f1" stopOpacity="1" />
          <stop offset="80%" stopColor="#6366f1" stopOpacity="1" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="guideGradH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
          <stop offset="20%" stopColor="#6366f1" stopOpacity="1" />
          <stop offset="80%" stopColor="#6366f1" stopOpacity="1" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Vertical Alignment Line */}
      {verticalLine && (() => {
        const screenX = verticalLine.coordinate * zoom + x;
        // Extend line generously across view
        const screenStartY = Math.min(verticalLine.start * zoom + y, -100);
        const screenEndY = Math.max(verticalLine.end * zoom + y, 2000);

        return (
          <g key="guide-vertical">
            <line
              x1={screenX}
              y1={screenStartY}
              x2={screenX}
              y2={screenEndY}
              stroke="url(#guideGradV)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            {/* Small center alignment indicator badge */}
            {verticalLine.snapType === 'center' && (
              <g transform={`translate(${screenX}, 24)`}>
                <rect
                  x={-24}
                  y={-10}
                  width={48}
                  height={20}
                  rx={10}
                  fill="#4f46e5"
                  className="shadow-sm"
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="sans-serif"
                >
                  Mitte
                </text>
              </g>
            )}
          </g>
        );
      })()}

      {/* Horizontal Alignment Line */}
      {horizontalLine && (() => {
        const screenY = horizontalLine.coordinate * zoom + y;
        const screenStartX = Math.min(horizontalLine.start * zoom + x, -100);
        const screenEndX = Math.max(horizontalLine.end * zoom + x, 3000);

        return (
          <g key="guide-horizontal">
            <line
              x1={screenStartX}
              y1={screenY}
              x2={screenEndX}
              y2={screenY}
              stroke="url(#guideGradH)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            {horizontalLine.snapType === 'center' && (
              <g transform={`translate(28, ${screenY})`}>
                <rect
                  x={-24}
                  y={-10}
                  width={48}
                  height={20}
                  rx={10}
                  fill="#4f46e5"
                  className="shadow-sm"
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="sans-serif"
                >
                  Mitte
                </text>
              </g>
            )}
          </g>
        );
      })()}
    </svg>
  );
};
