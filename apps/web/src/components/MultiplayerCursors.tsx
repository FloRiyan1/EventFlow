import React from 'react';
import { ViewportPortal } from '@xyflow/react';
import { useCollaboration } from '../collaborationContext';
import { useStore } from '../storeContext';

export const MultiplayerCursors: React.FC = () => {
  const { status } = useCollaboration();
  const activeBoardId = useStore((s) => s.activeBoardId);

  if (!status.connected && status.peers.length === 0) {
    return null;
  }

  // Filter peers with active cursor position
  const activePeers = status.peers.filter((p) => Boolean(p.cursor));

  return (
    <ViewportPortal>
      <div className="pointer-events-none select-none z-50">
        {activePeers.map((peer) => {
          if (!peer.cursor) return null;
          const { x, y } = peer.cursor;
          const color = peer.user.color || '#2563EB';

          return (
            <div
              key={peer.clientId}
              className="absolute top-0 left-0 transition-transform duration-75 ease-out"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                willChange: 'transform',
              }}
            >
              {/* Cursor SVG */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-md"
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Name Badge */}
              <div
                className="inline-flex items-center px-2 py-0.5 mt-0.5 ml-2.5 rounded-full text-xs font-semibold text-white shadow-sm whitespace-nowrap"
                style={{ backgroundColor: color }}
              >
                {peer.user.name || 'Kollege'}
              </div>
            </div>
          );
        })}
      </div>
    </ViewportPortal>
  );
};
