import React from 'react';
import { ViewportPortal, useNodes } from '@xyflow/react';
import { useCollaboration } from '../collaborationContext';
import { useStore } from '../storeContext';
import { MapPin } from 'lucide-react';

export const MultiplayerCursors: React.FC = () => {
  const { status } = useCollaboration();
  const activeBoardId = useStore((s) => s.activeBoardId);
  const nodes = useNodes();

  if (!status.connected && status.peers.length === 0) {
    return null;
  }

  // Filter peers on the active board (or peers with no boardId yet set)
  const boardPeers = status.peers.filter(
    (p) => !p.activeBoardId || p.activeBoardId === activeBoardId
  );

  return (
    <ViewportPortal>
      <div className="pointer-events-none select-none z-50">
        {/* 1. Remote Node Selection Highlights */}
        {boardPeers.map((peer) => {
          if (!peer.selection || peer.selection.length === 0) return null;
          const color = peer.user.color || '#2563EB';

          return (
            <React.Fragment key={`sel-${peer.clientId}`}>
              {peer.selection.map((nodeId) => {
                const node = nodes.find((n) => n.id === nodeId);
                if (!node) return null;

                const width = node.measured?.width ?? (typeof node.style?.width === 'number' ? node.style.width : 260);
                const height = node.measured?.height ?? (typeof node.style?.height === 'number' ? node.style.height : 140);
                const x = node.position.x;
                const y = node.position.y;

                return (
                  <div
                    key={`node-sel-${peer.clientId}-${nodeId}`}
                    className="absolute rounded-xl transition-all duration-150"
                    style={{
                      transform: `translate(${x - 4}px, ${y - 4}px)`,
                      width: width + 8,
                      height: height + 8,
                      border: `2px dashed ${color}`,
                      backgroundColor: `${color}14`,
                      boxShadow: `0 0 12px ${color}30`,
                    }}
                  >
                    <div
                      className="absolute -top-3.5 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-md flex items-center gap-1 whitespace-nowrap"
                      style={{ backgroundColor: color }}
                    >
                      <span>{peer.user.name || 'Kollege'}</span>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* 2. Canvas Pings / Radar Pulsing Rings */}
        {boardPeers.map((peer) => {
          if (!peer.ping) return null;
          const { x, y } = peer.ping;
          const color = peer.user.color || '#F59E0B';

          return (
            <div
              key={`ping-${peer.clientId}-${peer.ping.timestamp}`}
              className="absolute top-0 left-0"
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
            >
              {/* Outer Pulse Ripple */}
              <div
                className="absolute -top-12 -left-12 w-24 h-24 rounded-full border-2 animate-ping opacity-60 pointer-events-none"
                style={{ borderColor: color, backgroundColor: `${color}20` }}
              />
              {/* Inner Expanding Ring */}
              <div
                className="absolute -top-6 -left-6 w-12 h-12 rounded-full border-2 animate-pulse pointer-events-none"
                style={{ borderColor: color }}
              />
              {/* Center Pin & Floating Badge */}
              <div
                className="relative -top-8 -left-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-xl animate-bounce whitespace-nowrap"
                style={{ backgroundColor: color }}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{peer.user.name || 'Kollege'}</span>
              </div>
            </div>
          );
        })}

        {/* 3. Live Mouse Cursors */}
        {boardPeers.map((peer) => {
          if (!peer.cursor) return null;
          const { x, y } = peer.cursor;
          const color = peer.user.color || '#2563EB';

          return (
            <div
              key={`cursor-${peer.clientId}`}
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
