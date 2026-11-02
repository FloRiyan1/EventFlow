export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface AlignmentGuideLine {
  type: 'vertical' | 'horizontal';
  coordinate: number;
  start: number;
  end: number;
  targetNodeId: string;
  snapType: 'center' | 'edge';
}

export interface SnapResult {
  x: number;
  y: number;
  verticalLine: AlignmentGuideLine | null;
  horizontalLine: AlignmentGuideLine | null;
}

/** Default approximate dimensions for domain node kinds when unmeasured */
export const DEFAULT_NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  screen: { width: 260, height: 420 },
  endpoint: { width: 260, height: 180 },
  model: { width: 280, height: 200 },
  userAction: { width: 140, height: 44 },
  note: { width: 220, height: 120 },
  flowRef: { width: 220, height: 60 },
};

export function getNodeBounds(
  node: {
    id: string;
    kind?: string;
    type?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
    style?: { width?: number | string; height?: number | string };
  }
): BoundingBox {
  const kind = node.kind || node.type || 'model';
  const defaults = DEFAULT_NODE_DIMENSIONS[kind] || { width: 200, height: 100 };

  const w =
    typeof node.measured?.width === 'number' && node.measured.width > 0
      ? node.measured.width
      : typeof node.width === 'number' && node.width > 0
      ? node.width
      : typeof node.style?.width === 'number'
      ? node.style.width
      : defaults.width;

  const h =
    typeof node.measured?.height === 'number' && node.measured.height > 0
      ? node.measured.height
      : typeof node.height === 'number' && node.height > 0
      ? node.height
      : typeof node.style?.height === 'number'
      ? node.style.height
      : defaults.height;

  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: w,
    height: h,
    centerX: node.position.x + w / 2,
    centerY: node.position.y + h / 2,
  };
}

/**
 * Calculates magnetic snapping to other nodes' center and edges, with highest priority given to center alignment.
 */
export function calculateAlignmentSnap(
  draggedNode: {
    id: string;
    kind?: string;
    type?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
    style?: { width?: number | string; height?: number | string };
  },
  otherNodes: Array<{
    id: string;
    kind?: string;
    type?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
    style?: { width?: number | string; height?: number | string };
  }>,
  snapDistance = 8
): SnapResult {
  const current = getNodeBounds(draggedNode);
  let snappedX = current.x;
  let snappedY = current.y;
  let verticalLine: AlignmentGuideLine | null = null;
  let horizontalLine: AlignmentGuideLine | null = null;

  let minDiffX = snapDistance + 1;
  let minDiffY = snapDistance + 1;

  for (const other of otherNodes) {
    if (other.id === draggedNode.id) continue;
    const target = getNodeBounds(other);

    // --- Vertical Guide (X-Axis Alignment) ---
    // 1. Center-to-Center (Highest priority)
    const diffCenterX = Math.abs(current.centerX - target.centerX);
    if (diffCenterX <= snapDistance && diffCenterX < minDiffX) {
      minDiffX = diffCenterX;
      snappedX = target.centerX - current.width / 2;
      const minY = Math.min(current.y, target.y) - 40;
      const maxY = Math.max(current.y + current.height, target.y + target.height) + 40;
      verticalLine = {
        type: 'vertical',
        coordinate: target.centerX,
        start: minY,
        end: maxY,
        targetNodeId: target.id,
        snapType: 'center',
      };
    } else if (diffCenterX > snapDistance) {
      // 2. Left-to-Left
      const diffLeft = Math.abs(current.x - target.x);
      if (diffLeft <= snapDistance && diffLeft < minDiffX) {
        minDiffX = diffLeft;
        snappedX = target.x;
        const minY = Math.min(current.y, target.y) - 40;
        const maxY = Math.max(current.y + current.height, target.y + target.height) + 40;
        verticalLine = {
          type: 'vertical',
          coordinate: target.x,
          start: minY,
          end: maxY,
          targetNodeId: target.id,
          snapType: 'edge',
        };
      }
      // 3. Right-to-Right
      const diffRight = Math.abs(current.x + current.width - (target.x + target.width));
      if (diffRight <= snapDistance && diffRight < minDiffX) {
        minDiffX = diffRight;
        snappedX = target.x + target.width - current.width;
        const minY = Math.min(current.y, target.y) - 40;
        const maxY = Math.max(current.y + current.height, target.y + target.height) + 40;
        verticalLine = {
          type: 'vertical',
          coordinate: target.x + target.width,
          start: minY,
          end: maxY,
          targetNodeId: target.id,
          snapType: 'edge',
        };
      }
    }

    // --- Horizontal Guide (Y-Axis Alignment) ---
    // 1. Center-to-Center (Highest priority)
    const diffCenterY = Math.abs(current.centerY - target.centerY);
    if (diffCenterY <= snapDistance && diffCenterY < minDiffY) {
      minDiffY = diffCenterY;
      snappedY = target.centerY - current.height / 2;
      const minX = Math.min(current.x, target.x) - 40;
      const maxX = Math.max(current.x + current.width, target.x + target.width) + 40;
      horizontalLine = {
        type: 'horizontal',
        coordinate: target.centerY,
        start: minX,
        end: maxX,
        targetNodeId: target.id,
        snapType: 'center',
      };
    } else if (diffCenterY > snapDistance) {
      // 2. Top-to-Top
      const diffTop = Math.abs(current.y - target.y);
      if (diffTop <= snapDistance && diffTop < minDiffY) {
        minDiffY = diffTop;
        snappedY = target.y;
        const minX = Math.min(current.x, target.x) - 40;
        const maxX = Math.max(current.x + current.width, target.x + target.width) + 40;
        horizontalLine = {
          type: 'horizontal',
          coordinate: target.y,
          start: minX,
          end: maxX,
          targetNodeId: target.id,
          snapType: 'edge',
        };
      }
      // 3. Bottom-to-Bottom
      const diffBottom = Math.abs(current.y + current.height - (target.y + target.height));
      if (diffBottom <= snapDistance && diffBottom < minDiffY) {
        minDiffY = diffBottom;
        snappedY = target.y + target.height - current.height;
        const minX = Math.min(current.x, target.x) - 40;
        const maxX = Math.max(current.x + current.width, target.x + target.width) + 40;
        horizontalLine = {
          type: 'horizontal',
          coordinate: target.y + target.height,
          start: minX,
          end: maxX,
          targetNodeId: target.id,
          snapType: 'edge',
        };
      }
    }
  }

  return {
    x: Math.round(snappedX),
    y: Math.round(snappedY),
    verticalLine,
    horizontalLine,
  };
}

/**
 * Snaps a coordinate to the nearest grid increment (e.g. 16px or 24px)
 */
export function snapToGridValue(val: number, gridSize = 20): number {
  return Math.round(val / gridSize) * gridSize;
}

export type AlignmentMode =
  | 'centerH'
  | 'centerV'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'distributeH'
  | 'distributeV';

/**
 * Aligns a set of nodes according to the given alignment mode.
 * Returns an array of updated node positions: { id, position: { x, y } }
 */
export function alignNodes(
  nodes: Array<{
    id: string;
    kind?: string;
    type?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
    style?: { width?: number | string; height?: number | string };
  }>,
  mode: AlignmentMode
): Array<{ id: string; position: { x: number; y: number } }> {
  if (nodes.length <= 1) return [];

  const boundsList = nodes.map(getNodeBounds);

  switch (mode) {
    case 'centerH': {
      // Align all nodes along their horizontal centers (same X center)
      const avgCenterX =
        boundsList.reduce((acc, b) => acc + b.centerX, 0) / boundsList.length;
      return boundsList.map((b) => ({
        id: b.id,
        position: {
          x: Math.round(avgCenterX - b.width / 2),
          y: Math.round(b.y),
        },
      }));
    }

    case 'centerV': {
      // Align all nodes along their vertical centers (same Y center)
      const avgCenterY =
        boundsList.reduce((acc, b) => acc + b.centerY, 0) / boundsList.length;
      return boundsList.map((b) => ({
        id: b.id,
        position: {
          x: Math.round(b.x),
          y: Math.round(avgCenterY - b.height / 2),
        },
      }));
    }

    case 'left': {
      const minX = Math.min(...boundsList.map((b) => b.x));
      return boundsList.map((b) => ({
        id: b.id,
        position: { x: Math.round(minX), y: Math.round(b.y) },
      }));
    }

    case 'right': {
      const maxRight = Math.max(...boundsList.map((b) => b.x + b.width));
      return boundsList.map((b) => ({
        id: b.id,
        position: { x: Math.round(maxRight - b.width), y: Math.round(b.y) },
      }));
    }

    case 'top': {
      const minY = Math.min(...boundsList.map((b) => b.y));
      return boundsList.map((b) => ({
        id: b.id,
        position: { x: Math.round(b.x), y: Math.round(minY) },
      }));
    }

    case 'bottom': {
      const maxBottom = Math.max(...boundsList.map((b) => b.y + b.height));
      return boundsList.map((b) => ({
        id: b.id,
        position: { x: Math.round(b.x), y: Math.round(maxBottom - b.height) },
      }));
    }

    case 'distributeH': {
      if (boundsList.length < 3) return [];
      const sorted = [...boundsList].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalWidth = sorted.slice(0, -1).reduce((acc, b) => acc + b.width, 0);
      const totalSpan = last.x - first.x;
      const gap = (totalSpan - totalWidth) / (sorted.length - 1);

      let currentX = first.x;
      return sorted.map((b, idx) => {
        if (idx === 0) return { id: b.id, position: { x: b.x, y: b.y } };
        if (idx === sorted.length - 1) return { id: b.id, position: { x: b.x, y: b.y } };
        currentX += sorted[idx - 1].width + gap;
        return {
          id: b.id,
          position: { x: Math.round(currentX), y: Math.round(b.y) },
        };
      });
    }

    case 'distributeV': {
      if (boundsList.length < 3) return [];
      const sorted = [...boundsList].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalHeight = sorted.slice(0, -1).reduce((acc, b) => acc + b.height, 0);
      const totalSpan = last.y - first.y;
      const gap = (totalSpan - totalHeight) / (sorted.length - 1);

      let currentY = first.y;
      return sorted.map((b, idx) => {
        if (idx === 0) return { id: b.id, position: { x: b.x, y: b.y } };
        if (idx === sorted.length - 1) return { id: b.id, position: { x: b.x, y: b.y } };
        currentY += sorted[idx - 1].height + gap;
        return {
          id: b.id,
          position: { x: Math.round(b.x), y: Math.round(currentY) },
        };
      });
    }

    default:
      return [];
  }
}
