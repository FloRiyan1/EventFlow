import { createModel } from './factory';
import { referencedTypeNames, renameTypeInExpr } from './fields';
import { uid } from './ids';
import type {
  Board, ComponentDef, EdgeKind, Endpoint, Field, FlowEdge, FlowNode, Hotspot, Lane, LaneKind, Model,
  Project, ScreenNode, Trigger,
} from './schema';

/**
 * Pure helper functions operating on a project. Functions that mutate are meant to be
 * called inside `editorStore.update(draft => ...)` (Immer draft), queries work on any project.
 */

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getBoard(p: Project, boardId: string): Board {
  const board = p.boards.find((b) => b.id === boardId);
  if (!board) throw new Error(`Board ${boardId} nicht gefunden`);
  return board;
}

export function getNode(board: Board, nodeId: string): FlowNode | undefined {
  return board.nodes.find((n) => n.id === nodeId);
}

export function getScreen(board: Board, nodeId: string): ScreenNode | undefined {
  const n = getNode(board, nodeId);
  return n?.kind === 'screen' ? n : undefined;
}

export function findModelByName(p: Project, name: string): Model | undefined {
  return p.models.find((m) => m.name === name);
}

export const triggerHandleId = (triggerId: string): string => `t:${triggerId}`;

export interface TriggerRef {
  node: ScreenNode;
  hotspot: Hotspot;
  trigger: Trigger;
}

export function findTrigger(board: Board, handleId: string): TriggerRef | undefined {
  if (!handleId.startsWith('t:')) return undefined;
  const triggerId = handleId.slice(2);
  for (const node of board.nodes) {
    if (node.kind !== 'screen') continue;
    for (const hotspot of node.hotspots) {
      const trigger = hotspot.triggers.find((t) => t.id === triggerId);
      if (trigger) return { node, hotspot, trigger };
    }
  }
  return undefined;
}

export function triggerLabel(ref: Pick<TriggerRef, 'hotspot' | 'trigger'>): string {
  const cond = ref.trigger.condition.trim();
  return `${ref.trigger.event}: ${ref.hotspot.label}${cond ? ` [${cond}]` : ''}`;
}

export function nodeTitle(p: Project, node: FlowNode): string {
  switch (node.kind) {
    case 'screen':
      return node.title || 'Screen';
    case 'userAction':
      return node.label || 'User Action';
    case 'note':
      return node.text.split('\n')[0] || 'Notiz';
    case 'flowRef': {
      const b = p.boards.find((board) => board.id === node.targetBoardId);
      return node.label || (b ? `Flow: ${b.name}` : 'Gelöschter Flow');
    }
    case 'model':
      return p.models.find((m) => m.id === node.modelId)?.name ?? 'Gelöschtes Model';
    case 'endpoint': {
      const ep = p.endpoints.find((e) => e.id === node.endpointId);
      return ep ? `${ep.method} ${ep.path}` : 'Gelöschter Endpoint';
    }
  }
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

export interface LaneBox {
  lane: Lane;
  top: number;
  bottom: number;
}

/** Lanes are stacked vertically starting at y = 0. */
export function laneLayout(board: Board): LaneBox[] {
  let top = 0;
  return board.lanes.map((lane) => {
    const box = { lane, top, bottom: top + lane.height };
    top += lane.height;
    return box;
  });
}

export function laneAt(board: Board, y: number): LaneBox | undefined {
  return laneLayout(board).find((l) => y >= l.top && y < l.bottom);
}

export function laneOfKind(board: Board, kind: LaneKind): LaneBox | undefined {
  return laneLayout(board).find((l) => l.lane.kind === kind);
}

// ---------------------------------------------------------------------------
// Nodes, hotspots, edges
// ---------------------------------------------------------------------------

export function removeNodes(board: Board, ids: Set<string>): void {
  board.nodes = board.nodes.filter((n) => !ids.has(n.id));
  board.edges = board.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
}

export function removeEdges(board: Board, edgeIds: Set<string>): void {
  board.edges = board.edges.filter((e) => !edgeIds.has(e.id));
}

export function removeEdgesByHandle(board: Board, handleIds: Set<string>): void {
  board.edges = board.edges.filter((e) => !(e.sourceHandle && handleIds.has(e.sourceHandle)));
}

export function removeHotspot(board: Board, nodeId: string, hotspotId: string): void {
  const screen = getScreen(board, nodeId);
  const hotspot = screen?.hotspots.find((h) => h.id === hotspotId);
  if (!screen || !hotspot) return;
  removeEdgesByHandle(board, new Set(hotspot.triggers.map((t) => triggerHandleId(t.id))));
  screen.hotspots = screen.hotspots.filter((h) => h.id !== hotspotId);
}

export function removeTrigger(board: Board, nodeId: string, hotspotId: string, triggerId: string): void {
  const hotspot = getScreen(board, nodeId)?.hotspots.find((h) => h.id === hotspotId);
  if (!hotspot) return;
  removeEdgesByHandle(board, new Set([triggerHandleId(triggerId)]));
  hotspot.triggers = hotspot.triggers.filter((t) => t.id !== triggerId);
}

export function inferEdgeKind(board: Board, source: string, target: string, sourceHandle?: string | null): EdgeKind {
  if (sourceHandle?.startsWith('t:')) return 'trigger';
  const s = getNode(board, source);
  const t = getNode(board, target);
  if (s?.kind === 'screen' && t?.kind === 'endpoint') return 'trigger';
  if (s?.kind === 'screen' && t?.kind === 'screen') return 'navigation';
  if (s?.kind === 'endpoint' && t?.kind === 'model') return 'response';
  if (s?.kind === 'model' && t?.kind === 'endpoint') return 'request';
  return 'flow';
}

export interface ConnectionInput {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/**
 * Adds an edge if it is valid and not a duplicate. Connecting an endpoint to a model also
 * fills the endpoint's response/request model if it was not set yet.
 */
export function connect(p: Project, board: Board, c: ConnectionInput): FlowEdge | null {
  if (c.source === c.target) return null;
  const sourceHandle = c.sourceHandle ?? null;
  const targetHandle = c.targetHandle ?? null;
  const duplicate = board.edges.some(
    (e) =>
      e.source === c.source &&
      e.target === c.target &&
      e.sourceHandle === sourceHandle &&
      e.targetHandle === targetHandle,
  );
  if (duplicate) return null;

  const kind = inferEdgeKind(board, c.source, c.target, sourceHandle);
  let label = '';
  if (sourceHandle?.startsWith('t:')) {
    const trig = findTrigger(board, sourceHandle);
    if (trig) {
      label = triggerLabel(trig);
    }
  }
  const edge: FlowEdge = { id: uid('e_'), source: c.source, target: c.target, sourceHandle, targetHandle, kind, label };
  board.edges.push(edge);

  const s = getNode(board, c.source);
  const t = getNode(board, c.target);
  if (kind === 'response' && s?.kind === 'endpoint' && t?.kind === 'model') {
    const ep = p.endpoints.find((e) => e.id === s.endpointId);
    if (ep && !ep.responseModelId) ep.responseModelId = t.modelId;
  }
  if (kind === 'request' && s?.kind === 'model' && t?.kind === 'endpoint') {
    const ep = p.endpoints.find((e) => e.id === t.endpointId);
    if (ep && !ep.requestModelId) ep.requestModelId = s.modelId;
  }
  return edge;
}

// ---------------------------------------------------------------------------
// Registry operations
// ---------------------------------------------------------------------------

/** Renames a model and updates every type expression that references it. */
export function renameModel(p: Project, modelId: string, newName: string): void {
  const model = p.models.find((m) => m.id === modelId);
  if (!model || model.name === newName) return;
  const oldName = model.name;
  model.name = newName;
  const fix = (f: Field) => {
    f.type = renameTypeInExpr(f.type, oldName, newName);
  };
  p.models.forEach((m) => m.fields.forEach(fix));
  p.endpoints.forEach((e) => e.params.forEach(fix));
}

export function deleteModel(p: Project, modelId: string): void {
  p.models = p.models.filter((m) => m.id !== modelId);
  for (const board of p.boards) {
    const ids = board.nodes.filter((n) => n.kind === 'model' && n.modelId === modelId).map((n) => n.id);
    removeNodes(board, new Set(ids));
  }
  for (const ep of p.endpoints) {
    if (ep.requestModelId === modelId) delete ep.requestModelId;
    if (ep.responseModelId === modelId) delete ep.responseModelId;
  }
}

export function deleteEndpoint(p: Project, endpointId: string): void {
  p.endpoints = p.endpoints.filter((e) => e.id !== endpointId);
  for (const board of p.boards) {
    const ids = board.nodes.filter((n) => n.kind === 'endpoint' && n.endpointId === endpointId).map((n) => n.id);
    removeNodes(board, new Set(ids));
  }
}

export function deleteComponent(p: Project, componentId: string): void {
  p.components = p.components.filter((c) => c.id !== componentId);
  for (const board of p.boards) {
    for (const node of board.nodes) {
      if (node.kind !== 'screen') continue;
      for (const h of node.hotspots) if (h.componentId === componentId) delete h.componentId;
    }
  }
}

export function deleteBoard(p: Project, boardId: string): void {
  if (p.boards.length <= 1) return;
  p.boards = p.boards.filter((b) => b.id !== boardId);
  for (const board of p.boards) {
    const ids = board.nodes.filter((n) => n.kind === 'flowRef' && n.targetBoardId === boardId).map((n) => n.id);
    if (ids.length > 0) removeNodes(board, new Set(ids));
  }
  const used = new Set(p.boards.flatMap((b) => b.nodes.flatMap((n) => (n.kind === 'screen' ? [n.assetId] : []))));
  for (const assetId of Object.keys(p.assets)) if (!used.has(assetId)) delete p.assets[assetId];
}

/**
 * Creates empty models for every referenced, not yet existing model type
 * (only identifiers starting with an uppercase letter). Returns the created names.
 */
export function ensureModelsForFields(p: Project, fields: Field[]): string[] {
  const created: string[] = [];
  for (const f of fields) {
    for (const name of referencedTypeNames(f.type)) {
      if (/^[A-Z]/.test(name) && !findModelByName(p, name)) {
        p.models.push(createModel(name));
        created.push(name);
      }
    }
  }
  return created;
}

export interface ModelUsages {
  boards: { id: string; name: string }[];
  models: Model[];
  endpoints: Endpoint[];
}

export function modelUsages(p: Project, modelId: string): ModelUsages {
  const model = p.models.find((m) => m.id === modelId);
  if (!model) return { boards: [], models: [], endpoints: [] };
  const refs = (fields: Field[]) => fields.some((f) => referencedTypeNames(f.type).includes(model.name));
  return {
    boards: p.boards
      .filter((b) => b.nodes.some((n) => n.kind === 'model' && n.modelId === modelId))
      .map((b) => ({ id: b.id, name: b.name })),
    models: p.models.filter((m) => m.id !== modelId && refs(m.fields)),
    endpoints: p.endpoints.filter(
      (e) => e.requestModelId === modelId || e.responseModelId === modelId || refs(e.params),
    ),
  };
}

export interface EndpointUsages {
  boards: { id: string; name: string }[];
}

export function endpointUsages(p: Project, endpointId: string): EndpointUsages {
  const endpoint = p.endpoints.find((e) => e.id === endpointId);
  if (!endpoint) return { boards: [] };
  return {
    boards: p.boards
      .filter((b) => b.nodes.some((n) => n.kind === 'endpoint' && n.endpointId === endpointId))
      .map((b) => ({ id: b.id, name: b.name })),
  };
}

export interface ComponentUsage {
  board: Board;
  node: ScreenNode;
  hotspot: Hotspot;
}

export function componentUsages(p: Project, component: ComponentDef | string): ComponentUsage[] {
  const id = typeof component === 'string' ? component : component.id;
  const result: ComponentUsage[] = [];
  for (const board of p.boards) {
    for (const node of board.nodes) {
      if (node.kind !== 'screen') continue;
      for (const hotspot of node.hotspots) if (hotspot.componentId === id) result.push({ board, node, hotspot });
    }
  }
  return result;
}
