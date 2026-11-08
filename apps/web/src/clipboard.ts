import type { FlowNode, Model, Project, EditorStore } from '@eventflow/core';
import { uid, createModel } from '@eventflow/core';

export interface ClipboardPayload {
  nodes: FlowNode[];
  models?: Model[];
  sourceBoardId?: string;
}

let inMemoryClipboard: ClipboardPayload | null = null;

// Initialize from sessionStorage if available
try {
  const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('eventflow_clipboard') : null;
  if (saved) {
    inMemoryClipboard = JSON.parse(saved);
  }
} catch (_) {}

/**
 * Copies the given nodes into the shared clipboard buffer, session storage, and system clipboard.
 */
export function copyNodes(nodes: FlowNode[], project?: Project, sourceBoardId?: string): void {
  if (!nodes || nodes.length === 0) return;

  const payload: ClipboardPayload = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    sourceBoardId,
  };

  // If any copied node is a model, bundle its model definition
  if (project?.models) {
    const modelIds = new Set(
      nodes
        .filter((n): n is FlowNode & { kind: 'model'; modelId: string } => n.kind === 'model' && 'modelId' in n)
        .map((n) => n.modelId)
    );
    if (modelIds.size > 0) {
      payload.models = project.models.filter((m) => modelIds.has(m.id));
    }
  }

  inMemoryClipboard = payload;

  try {
    sessionStorage.setItem('eventflow_clipboard', JSON.stringify(payload));
  } catch (_) {}

  try {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(
        JSON.stringify({
          type: 'eventflow/nodes',
          payload,
        })
      );
    }
  } catch (_) {}
}

/**
 * Checks if there are nodes stored in the clipboard.
 */
export function hasClipboardNodes(): boolean {
  return inMemoryClipboard !== null && inMemoryClipboard.nodes.length > 0;
}

/**
 * Gets the current copied nodes payload.
 */
export function getClipboardNodes(): ClipboardPayload | null {
  return inMemoryClipboard;
}

/**
 * Pastes clipboard nodes into a target board.
 * Returns the IDs of the newly created nodes.
 */
export function pasteClipboardNodes(params: {
  store: EditorStore;
  targetBoardId: string;
  isModelView?: boolean;
  targetPosition?: { x: number; y: number };
}): string[] {
  const { store, targetBoardId, isModelView, targetPosition } = params;
  if (!inMemoryClipboard || inMemoryClipboard.nodes.length === 0) return [];

  const { nodes, models: bundledModels } = inMemoryClipboard;
  const newSelectedIds: string[] = [];

  // Find bounding box top-left of copied nodes
  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
  }

  store.update((draft) => {
    const board = draft.boards.find((b) => b.id === targetBoardId);
    if (!board) return;

    for (const node of nodes) {
      const newNodeId = uid('n_');
      newSelectedIds.push(newNodeId);

      let newPos: { x: number; y: number };
      if (targetPosition) {
        newPos = {
          x: Math.round(targetPosition.x + (node.position.x - minX)),
          y: Math.round(targetPosition.y + (node.position.y - minY)),
        };
      } else {
        newPos = {
          x: Math.round(node.position.x + 40),
          y: Math.round(node.position.y + 40),
        };
      }

      const cloned: FlowNode = {
        ...JSON.parse(JSON.stringify(node)),
        id: newNodeId,
        position: newPos,
      };

      if (cloned.kind === 'model') {
        const origModelId = (node as any).modelId;
        const origModel =
          bundledModels?.find((m) => m.id === origModelId) ||
          draft.models.find((m) => m.id === origModelId);

        if (isModelView) {
          const alreadyOnBoard = board.nodes.some(
            (n) => n.kind === 'model' && (n as any).modelId === origModelId
          );
          if (alreadyOnBoard && origModel) {
            // Duplicate model so both exist on board
            const newModel = createModel(
              `${origModel.name}Kopie`,
              JSON.parse(JSON.stringify(origModel.fields))
            );
            draft.models.push(newModel);
            (cloned as any).modelId = newModel.id;
          } else if (origModel && !draft.models.some((m) => m.id === origModelId)) {
            draft.models.push(JSON.parse(JSON.stringify(origModel)));
          }
        } else {
          if (origModel && !draft.models.some((m) => m.id === origModelId)) {
            draft.models.push(JSON.parse(JSON.stringify(origModel)));
          }
        }
      }

      if (cloned.kind === 'screen') {
        cloned.title = `${cloned.title || 'Screen'} (Kopie)`;
        if (Array.isArray(cloned.hotspots)) {
          cloned.hotspots = cloned.hotspots.map((h) => ({
            ...h,
            id: uid('h_'),
            triggers: (h.triggers || []).map((t) => ({ ...t, id: uid('t_') })),
          }));
        }
      }

      board.nodes.push(cloned);
    }
  });

  // If no specific targetPosition, advance the positions for cascading subsequent pastes
  if (!targetPosition && inMemoryClipboard) {
    inMemoryClipboard.nodes = inMemoryClipboard.nodes.map((n) => ({
      ...n,
      position: {
        x: n.position.x + 40,
        y: n.position.y + 40,
      },
    }));
  }

  return newSelectedIds;
}

/**
 * Duplicates specified nodes directly on the board with an offset.
 */
export function duplicateNodes(params: {
  store: EditorStore;
  boardId: string;
  nodeIds: string[];
  isModelView?: boolean;
}): string[] {
  const { store, boardId, nodeIds, isModelView } = params;
  if (!nodeIds || nodeIds.length === 0) return [];

  const newSelectedIds: string[] = [];

  store.update((draft) => {
    const board = draft.boards.find((b) => b.id === boardId);
    if (!board) return;

    for (const id of nodeIds) {
      const original = board.nodes.find((n) => n.id === id);
      if (!original) continue;

      const newNodeId = uid('n_');
      newSelectedIds.push(newNodeId);

      const cloned: FlowNode = {
        ...JSON.parse(JSON.stringify(original)),
        id: newNodeId,
        position: {
          x: Math.round(original.position.x + 40),
          y: Math.round(original.position.y + 40),
        },
      };

      if (cloned.kind === 'model') {
        const origModelId = (original as any).modelId;
        const origModel = draft.models.find((m) => m.id === origModelId);
        if (isModelView && origModel) {
          const newModel = createModel(
            `${origModel.name}Kopie`,
            JSON.parse(JSON.stringify(origModel.fields))
          );
          draft.models.push(newModel);
          (cloned as any).modelId = newModel.id;
        }
      }

      if (cloned.kind === 'screen') {
        cloned.title = `${cloned.title || 'Screen'} (Kopie)`;
        if (Array.isArray(cloned.hotspots)) {
          cloned.hotspots = cloned.hotspots.map((h) => ({
            ...h,
            id: uid('h_'),
            triggers: (h.triggers || []).map((t) => ({ ...t, id: uid('t_') })),
          }));
        }
      }

      board.nodes.push(cloned);
    }
  });

  return newSelectedIds;
}
