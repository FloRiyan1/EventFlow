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
    case 'section':
      return node.label || 'Bereich';
    case 'shape':
      return node.label ? node.label.split('\n')[0] : (node.shapeType === 'circle' ? 'Kreis' : node.shapeType === 'text' ? 'Text' : 'Kasten');
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

export interface ModelHierarchyInfo {
  model: Model;
  isRoot: boolean;
  subModels: { field: Field; model: Model }[];
  parentModels: Model[];
  extendedModel?: Model;
  childModels: Model[];
  inheritedFields: Field[];
}

/**
 * Resolves all inherited fields of a model through its inheritance chain (ancestors, without cycles).
 */
export function getInheritedFields(p: Project, model: Model): Field[] {
  const result: Field[] = [];
  const visited = new Set<string>([model.id]);
  let currentId = model.extendsModelId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const parent = p.models.find((m) => m.id === currentId);
    if (!parent) break;
    result.unshift(...parent.fields);
    currentId = parent.extendsModelId;
  }

  return result;
}

/**
 * Returns all direct and indirect ancestor models in order (parent, grandparent, ...).
 */
export function getAncestorModels(p: Project, model: Model): Model[] {
  const ancestors: Model[] = [];
  const visited = new Set<string>([model.id]);
  let currentId = model.extendsModelId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const parent = p.models.find((m) => m.id === currentId);
    if (!parent) break;
    ancestors.push(parent);
    currentId = parent.extendsModelId;
  }

  return ancestors;
}

/**
 * Returns all direct and indirect child models that inherit from this model.
 */
export function getDescendantModels(p: Project, modelId: string): Model[] {
  const descendants: Model[] = [];
  const queue = [modelId];
  const visited = new Set<string>([modelId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = p.models.filter((m) => m.extendsModelId === curr && !visited.has(m.id));
    for (const ch of children) {
      visited.add(ch.id);
      descendants.push(ch);
      queue.push(ch.id);
    }
  }

  return descendants;
}

export function getModelHierarchyInfo(p: Project, modelId: string): ModelHierarchyInfo {
  const model = p.models.find((m) => m.id === modelId);
  if (!model) throw new Error(`Model ${modelId} nicht gefunden`);

  const modelMap = new Map(p.models.map((m) => [m.name, m]));

  const subModels: { field: Field; model: Model }[] = [];
  for (const f of model.fields) {
    const refs = referencedTypeNames(f.type);
    for (const refName of refs) {
      const target = modelMap.get(refName);
      if (target) {
        subModels.push({ field: f, model: target });
      }
    }
  }

  const parentModels = p.models.filter(
    (other) => other.id !== model.id && other.fields.some((f) => referencedTypeNames(f.type).includes(model.name))
  );

  const extendedModel = model.extendsModelId
    ? p.models.find((m) => m.id === model.extendsModelId)
    : undefined;
  const childModels = p.models.filter((m) => m.extendsModelId === model.id);
  const inheritedFields = getInheritedFields(p, model);

  return {
    model,
    isRoot: parentModels.length === 0 && !extendedModel,
    subModels,
    parentModels,
    extendedModel,
    childModels,
    inheritedFields,
  };
}

export interface InsertModelWithSubModelsOptions {
  basePosition?: { x: number; y: number };
  spacingX?: number;
  spacingY?: number;
}

export interface InsertedHierarchyResult {
  rootNodeId: string;
  createdNodeIds: string[];
  createdEdgeIds: string[];
}

export function insertModelWithSubModels(
  board: Board,
  p: Project,
  rootModelId: string,
  options: InsertModelWithSubModelsOptions = {}
): InsertedHierarchyResult {
  const rootModel = p.models.find((m) => m.id === rootModelId);
  if (!rootModel) throw new Error(`Model ${rootModelId} nicht gefunden`);

  const basePos = options.basePosition ?? { x: 300, y: 600 };
  const spacingX = options.spacingX ?? 340;
  const spacingY = options.spacingY ?? 260;

  const createdNodeIds: string[] = [];
  const createdEdgeIds: string[] = [];

  const rootNodeId = uid('n_');
  board.nodes.push({
    id: rootNodeId,
    kind: 'model',
    modelId: rootModel.id,
    position: { x: Math.round(basePos.x), y: Math.round(basePos.y) },
  });
  createdNodeIds.push(rootNodeId);

  const modelMap = new Map(p.models.map((m) => [m.name, m]));
  const visitedModelIds = new Set<string>([rootModel.id]);
  const modelToNodeMap = new Map<string, string>([[rootModel.id, rootNodeId]]);

  interface QueueItem {
    model: Model;
    parentNodeId: string;
    fieldName: string;
    level: number;
  }

  const queue: QueueItem[] = [];
  for (const field of rootModel.fields) {
    const refs = referencedTypeNames(field.type);
    for (const refName of refs) {
      const child = modelMap.get(refName);
      if (child) {
        queue.push({
          model: child,
          parentNodeId: rootNodeId,
          fieldName: field.name,
          level: 1,
        });
      }
    }
  }

  const levelCounts = new Map<number, number>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    let childNodeId = modelToNodeMap.get(item.model.id);

    if (!childNodeId) {
      visitedModelIds.add(item.model.id);
      childNodeId = uid('n_');
      modelToNodeMap.set(item.model.id, childNodeId);

      const countInLevel = levelCounts.get(item.level) || 0;
      levelCounts.set(item.level, countInLevel + 1);

      const posX = basePos.x + item.level * spacingX;
      const posY = basePos.y + countInLevel * spacingY;

      board.nodes.push({
        id: childNodeId,
        kind: 'model',
        modelId: item.model.id,
        position: { x: Math.round(posX), y: Math.round(posY) },
      });
      createdNodeIds.push(childNodeId);

      for (const field of item.model.fields) {
        const refs = referencedTypeNames(field.type);
        for (const refName of refs) {
          const grandChild = modelMap.get(refName);
          if (grandChild && !visitedModelIds.has(grandChild.id)) {
            queue.push({
              model: grandChild,
              parentNodeId: childNodeId,
              fieldName: field.name,
              level: item.level + 1,
            });
          }
        }
      }
    }

    const edgeId = uid('e_');
    board.edges.push({
      id: edgeId,
      source: item.parentNodeId,
      target: childNodeId,
      sourceHandle: null,
      targetHandle: null,
      kind: 'flow',
      label: item.fieldName,
    });
    createdEdgeIds.push(edgeId);
  }

  return { rootNodeId, createdNodeIds, createdEdgeIds };
}

export function insertSubModelsForNode(
  board: Board,
  p: Project,
  parentNodeId: string,
  options: InsertModelWithSubModelsOptions = {}
): { createdNodeIds: string[]; createdEdgeIds: string[] } {
  const parentNode = board.nodes.find((n) => n.id === parentNodeId);
  if (!parentNode || parentNode.kind !== 'model') {
    return { createdNodeIds: [], createdEdgeIds: [] };
  }

  const parentModel = p.models.find((m) => m.id === parentNode.modelId);
  if (!parentModel) return { createdNodeIds: [], createdEdgeIds: [] };

  const basePos = options.basePosition ?? parentNode.position;
  const spacingX = options.spacingX ?? 340;
  const spacingY = options.spacingY ?? 260;

  const createdNodeIds: string[] = [];
  const createdEdgeIds: string[] = [];

  const modelMap = new Map(p.models.map((m) => [m.name, m]));
  const visitedModelIds = new Set<string>([parentModel.id]);
  const modelToNodeMap = new Map<string, string>([[parentModel.id, parentNode.id]]);

  for (const node of board.nodes) {
    if (node.kind === 'model') {
      modelToNodeMap.set(node.modelId, node.id);
    }
  }

  interface QueueItem {
    model: Model;
    parentNodeId: string;
    fieldName: string;
    level: number;
  }

  const queue: QueueItem[] = [];
  for (const field of parentModel.fields) {
    const refs = referencedTypeNames(field.type);
    for (const refName of refs) {
      const child = modelMap.get(refName);
      if (child) {
        queue.push({
          model: child,
          parentNodeId: parentNode.id,
          fieldName: field.name,
          level: 1,
        });
      }
    }
  }

  const levelCounts = new Map<number, number>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    let childNodeId = modelToNodeMap.get(item.model.id);

    if (!childNodeId) {
      visitedModelIds.add(item.model.id);
      childNodeId = uid('n_');
      modelToNodeMap.set(item.model.id, childNodeId);

      const countInLevel = levelCounts.get(item.level) || 0;
      levelCounts.set(item.level, countInLevel + 1);

      const posX = basePos.x + item.level * spacingX;
      const posY = basePos.y + countInLevel * spacingY;

      board.nodes.push({
        id: childNodeId,
        kind: 'model',
        modelId: item.model.id,
        position: { x: Math.round(posX), y: Math.round(posY) },
      });
      createdNodeIds.push(childNodeId);

      for (const field of item.model.fields) {
        const refs = referencedTypeNames(field.type);
        for (const refName of refs) {
          const grandChild = modelMap.get(refName);
          if (grandChild && !visitedModelIds.has(grandChild.id)) {
            queue.push({
              model: grandChild,
              parentNodeId: childNodeId,
              fieldName: field.name,
              level: item.level + 1,
            });
          }
        }
      }
    }

    const edgeExists = board.edges.some(
      (e) => e.source === item.parentNodeId && e.target === childNodeId && e.label === item.fieldName
    );
    if (!edgeExists) {
      const edgeId = uid('e_');
      board.edges.push({
        id: edgeId,
        source: item.parentNodeId,
        target: childNodeId,
        sourceHandle: null,
        targetHandle: null,
        kind: 'flow',
        label: item.fieldName,
      });
      createdEdgeIds.push(edgeId);
    }
  }

  return { createdNodeIds, createdEdgeIds };
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

// ---------------------------------------------------------------------------
// Model field ordering and sorting
// ---------------------------------------------------------------------------

export type FieldSortCriterion = 'name-asc' | 'name-desc' | 'type-asc' | 'submodels-first' | 'required-first';

export function reorderModelField(model: Model, fromIndex: number, toIndex: number): void {
  if (fromIndex < 0 || fromIndex >= model.fields.length || toIndex < 0 || toIndex >= model.fields.length) {
    return;
  }
  const [moved] = model.fields.splice(fromIndex, 1);
  model.fields.splice(toIndex, 0, moved);
}

export function sortModelFields(p: Project, model: Model, criterion: FieldSortCriterion): void {
  const modelNames = new Set(p.models.map((m) => m.name));

  model.fields.sort((a, b) => {
    switch (criterion) {
      case 'name-asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'name-desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'type-asc':
        return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      case 'required-first':
        if (a.nullable !== b.nullable) {
          return a.nullable ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      case 'submodels-first': {
        const aIsSub = referencedTypeNames(a.type).some((name) => modelNames.has(name));
        const bIsSub = referencedTypeNames(b.type).some((name) => modelNames.has(name));
        if (aIsSub !== bIsSub) {
          return aIsSub ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }
      default:
        return 0;
    }
  });
}

// ---------------------------------------------------------------------------
// Model declaration parsing and application (e.g. "Customer extends AbstractBase")
// ---------------------------------------------------------------------------

export interface ParsedModelDeclaration {
  name: string;
  isAbstract?: boolean;
  extendsModelName?: string;
  hasDeclarationSyntax: boolean;
}

/**
 * Parses a model name/declaration string that may include keywords and inheritance syntax.
 * Examples:
 * - "Customer" -> { name: "Customer", isAbstract: false, hasDeclarationSyntax: false }
 * - "A extends AbstractA" -> { name: "A", extendsModelName: "AbstractA", hasDeclarationSyntax: true }
 * - "abstract class AbstractA" -> { name: "AbstractA", isAbstract: true, hasDeclarationSyntax: true }
 * - "abstract Customer extends BaseEntity" -> { name: "Customer", isAbstract: true, extendsModelName: "BaseEntity", hasDeclarationSyntax: true }
 * - "Customer : BaseEntity" -> { name: "Customer", extendsModelName: "BaseEntity", hasDeclarationSyntax: true }
 */
export function parseModelDeclaration(input: string): ParsedModelDeclaration {
  const original = (input || '').trim();
  if (!original) {
    return { name: '', isAbstract: false, hasDeclarationSyntax: false };
  }

  let text = original;
  let isAbstract: boolean | undefined = undefined;
  let hasDeclarationSyntax = false;

  // 1. Check for abstract keyword
  if (/\babstract\b/i.test(text)) {
    isAbstract = true;
    hasDeclarationSyntax = true;
    text = text.replace(/\babstract\b/gi, ' ');
  }

  // 2. Check for keywords (class, record, interface, public, internal, etc.)
  if (/\b(class|record|interface|public|internal|protected|private)\b/i.test(text)) {
    hasDeclarationSyntax = true;
    text = text.replace(/\b(class|record|interface|public|internal|protected|private)\b/gi, ' ');
  }

  // 3. Strip implements clause if present (e.g. implements Serializable)
  if (/\bimplements\b/i.test(text)) {
    hasDeclarationSyntax = true;
    text = text.replace(/\bimplements\s+[A-Za-z0-9_,\s<>]+/gi, ' ');
  }

  // 4. Check for extends clause: "extends ParentName"
  let extendsModelName: string | undefined = undefined;
  const extendsMatch = /\bextends\s+([A-Za-z0-9_]+)(?:<[^>]+>)?/i.exec(text);
  if (extendsMatch) {
    hasDeclarationSyntax = true;
    extendsModelName = extendsMatch[1];
    text = text.replace(/\bextends\s+[A-Za-z0-9_]+(?:<[^>]+>)?/gi, ' ');
  } else {
    // Check for colon inheritance: "Name : ParentName"
    const colonMatch = /:\s*([A-Za-z0-9_]+)(?:<[^>]+>)?/.exec(text);
    if (colonMatch) {
      hasDeclarationSyntax = true;
      extendsModelName = colonMatch[1];
      text = text.replace(/:\s*[A-Za-z0-9_]+(?:<[^>]+>)?/g, ' ');
    }
  }

  // 5. Strip generic parameters like <T> from the name
  text = text.replace(/<[^>]+>/g, ' ');

  // 6. Clean up braces, semicolons, parens
  text = text.replace(/[{}\(\);]/g, ' ').trim();

  // 7. Extract the name from remaining words
  const words = text.split(/\s+/).filter(Boolean);
  const name = words[0] || original.trim();

  return {
    name,
    isAbstract,
    extendsModelName,
    hasDeclarationSyntax,
  };
}

/**
 * Formats a model declaration string from a model and its parent name.
 * e.g. "abstract Customer extends BaseEntity" or "Customer"
 */
export function formatModelDeclaration(model: Model, parentModelName?: string): string {
  const parts: string[] = [];
  if (model.isAbstract) parts.push('abstract');
  parts.push(model.name);
  if (parentModelName) parts.push(`extends ${parentModelName}`);
  return parts.join(' ');
}

/**
 * Applies a declaration text to an existing model in a project.
 * Handles renaming, setting/clearing isAbstract, resolving or auto-creating the parent model,
 * and checking for circular inheritance cycles.
 */
export function applyModelDeclaration(
  project: Project,
  model: Model,
  declarationText: string
): {
  name: string;
  isAbstract: boolean;
  extendsModelId?: string;
  createdParent?: Model;
} {
  const parsed = parseModelDeclaration(declarationText);
  if (!parsed.name) {
    return {
      name: model.name,
      isAbstract: model.isAbstract ?? false,
      extendsModelId: model.extendsModelId,
    };
  }

  const oldName = model.name;
  if (parsed.name !== oldName) {
    renameModel(project, model.id, parsed.name);
  }

  let createdParent: Model | undefined = undefined;
  let newExtendsModelId = model.extendsModelId;

  if (parsed.extendsModelName) {
    let parent = project.models.find((m) => m.name.toLowerCase() === parsed.extendsModelName?.toLowerCase());
    if (!parent) {
      const isParentAbstract = /^abstract/i.test(parsed.extendsModelName);
      parent = createModel(parsed.extendsModelName, [], undefined, isParentAbstract);
      project.models.push(parent);
      createdParent = parent;
    }

    // Cycle check: parent cannot be the model itself or an existing descendant
    const descendants = new Set(getDescendantModels(project, model.id).map((d) => d.id));
    if (parent.id !== model.id && !descendants.has(parent.id)) {
      newExtendsModelId = parent.id;
      model.extendsModelId = parent.id;
    }
  } else if (parsed.hasDeclarationSyntax && !parsed.extendsModelName) {
    // User explicitly wrote declaration syntax without extends (e.g. "Customer" or "abstract Customer" or "class Customer")
    newExtendsModelId = undefined;
    model.extendsModelId = undefined;
  }

  if (parsed.isAbstract !== undefined) {
    model.isAbstract = parsed.isAbstract;
  }

  return {
    name: model.name,
    isAbstract: model.isAbstract ?? false,
    extendsModelId: newExtendsModelId,
    createdParent,
  };
}

