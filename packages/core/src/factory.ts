import { uid } from './ids';
import { SCHEMA_VERSION } from './schema';
import type { Board, ComponentDef, Endpoint, Field, HttpMethod, Lane, Model, Project, SectionNode, ShapeNode } from './schema';

export function createLanes(): Lane[] {
  return [
    { id: uid('l_'), name: 'User Actions', color: '#FFC21A', height: 520, kind: 'ui' },
    { id: uid('l_'), name: 'API', color: '#1E9BFF', height: 280, kind: 'api' },
    { id: uid('l_'), name: 'Model', color: '#FF9F1C', height: 600, kind: 'model' },
  ];
}

export function createBoard(name = 'Neuer Flow', kind: 'flow' | 'model' = 'flow'): Board {
  return {
    id: uid('b_'),
    name,
    kind,
    lanes: kind === 'model' ? [] : createLanes(),
    nodes: [],
    edges: [],
  };
}

export function createModelBoard(name = 'Datenmodell'): Board {
  return createBoard(name, 'model');
}

export function createEmptyProject(name = 'Neues Projekt'): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('p_'),
    name,
    boards: [createBoard('Flow 1')],
    models: [],
    endpoints: [],
    components: [],
    assets: {},
  };
}

export function createModel(
  name: string,
  fields: Field[] = [],
  extendsModelId?: string,
  isAbstract = false
): Model {
  return { id: uid('m_'), name, description: '', fields, extendsModelId, isAbstract };
}

export function createEndpoint(method: HttpMethod = 'GET', path = '/neu'): Endpoint {
  return { id: uid('ep_'), method, path, description: '', params: [] };
}

export function createComponent(name: string, kind = 'button'): ComponentDef {
  return { id: uid('c_'), name, kind };
}

export function createSectionNode(
  label = 'Neuer Bereich',
  x = 100,
  y = 100,
  width = 500,
  height = 380,
  color = '#3b82f6'
): SectionNode {
  return {
    id: uid('sec_'),
    kind: 'section',
    label,
    color,
    width,
    height,
    position: { x, y },
  };
}

export function createShapeNode(
  shapeType: 'rectangle' | 'circle' | 'text',
  x = 100,
  y = 100,
  label = '',
  color?: string
): ShapeNode {
  const defaultColors: Record<string, string> = {
    rectangle: '#f1f5f9',
    circle: '#e0f2fe',
    text: 'transparent',
  };
  return {
    id: uid('shp_'),
    kind: 'shape',
    shapeType,
    label: label || (shapeType === 'text' ? 'Text hier eingeben...' : ''),
    color: color ?? defaultColors[shapeType] ?? '#f1f5f9',
    width: shapeType === 'circle' ? 140 : shapeType === 'text' ? 220 : 180,
    height: shapeType === 'circle' ? 140 : shapeType === 'text' ? 50 : 120,
    fontSize: shapeType === 'text' ? 18 : 14,
    position: { x, y },
  };
}

/** Returns `base`, or `base2`, `base3`, ... if the name is already taken. */
export function uniqueName(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  let name = base;
  let i = 2;
  while (taken.has(name)) name = `${base}${i++}`;
  return name;
}

/** Create a rich demo project matching the initial reference ("Positionen Erfassen") */
export function createInitialDemoProject(): Project {
  const project = createEmptyProject('Auftragserfassung');
  const board = project.boards[0];
  board.name = 'Positionen Erfassen';

  // 1. Models
  const taetigkeitModel = createModel('TaetigkeitPositionRESTModel', [
    { id: uid('f_'), name: 'uuid', type: 'String' },
    { id: uid('f_'), name: 'nummer', type: 'String', nullable: true },
    { id: uid('f_'), name: 'name', type: 'String', nullable: true },
    { id: uid('f_'), name: 'kurztext', type: 'String', nullable: true },
    { id: uid('f_'), name: 'langtext', type: 'String', nullable: true },
    { id: uid('f_'), name: 'einheit', type: 'String', nullable: true },
    { id: uid('f_'), name: 'preis', type: 'double', nullable: true },
    { id: uid('f_'), name: 'menge', type: 'double', nullable: true },
    { id: uid('f_'), name: 'sortIndex', type: 'int' },
    { id: uid('f_'), name: 'abgeschlossen', type: 'bool' },
    { id: uid('f_'), name: 'hasErfassungen', type: 'bool' },
    { id: uid('f_'), name: 'istMenge', type: 'double' },
    { id: uid('f_'), name: 'editable', type: 'bool' },
  ]);

  const pagedModel = createModel('PagedPositionenRESTModel', [
    { id: uid('f_'), name: 'positionen', type: 'List<TaetigkeitPositionRESTModel>' },
    { id: uid('f_'), name: 'currentPage', type: 'int' },
    { id: uid('f_'), name: 'requestedEntriesPerPage', type: 'int' },
  ]);

  const taetigkeitKriterienModel = createModel('TaetigkeitKriterienRESTModel', [
    { id: uid('f_'), name: 'uuid', type: 'String' },
    { id: uid('f_'), name: 'sortIndex', type: 'int' },
    { id: uid('f_'), name: 'bezeichnung', type: 'String' },
    { id: uid('f_'), name: 'selektierbareWerte', type: 'List<String>' },
  ]);

  const taetigkeitInfoModel = createModel('TaetigkeitKriterienInfoRESTModel', [
    { id: uid('f_'), name: 'progress', type: 'double' },
    { id: uid('f_'), name: 'kriterien', type: 'List<TaetigkeitKriterienRESTModel>' },
  ]);

  project.models = [taetigkeitModel, pagedModel, taetigkeitKriterienModel, taetigkeitInfoModel];

  // 2. Endpoints
  const ep1 = createEndpoint('POST', 'Taetigkeiten / Positionen');
  ep1.params = [
    { id: uid('f_'), name: 'taetigkeitUuid', type: 'String' },
    { id: uid('f_'), name: 'unvollstaendig', type: 'bool', nullable: true },
    { id: uid('f_'), name: 'query', type: 'String', nullable: true },
    { id: uid('f_'), name: 'scancode', type: 'String', nullable: true },
    { id: uid('f_'), name: 'page', type: 'int' },
    { id: uid('f_'), name: 'entriesPerPage', type: 'int' },
  ];
  ep1.responseModelId = pagedModel.id;

  const ep2 = createEndpoint('POST', 'Taetigkeiten / taetigkeitInfo');
  ep2.params = [
    { id: uid('f_'), name: 'taetigkeitUuid', type: 'String' },
  ];
  ep2.responseModelId = taetigkeitInfoModel.id;

  project.endpoints = [ep1, ep2];

  // 3. User Action Node
  const actionNodeId = uid('n_');
  board.nodes.push({
    id: actionNodeId,
    kind: 'userAction',
    label: 'Press Tätigkeit',
    position: { x: 120, y: 180 },
  });

  // 4. Endpoint Nodes on Canvas
  const ep1NodeId = uid('n_');
  board.nodes.push({
    id: ep1NodeId,
    kind: 'endpoint',
    endpointId: ep1.id,
    position: { x: 340, y: 550 },
  });

  const ep2NodeId = uid('n_');
  board.nodes.push({
    id: ep2NodeId,
    kind: 'endpoint',
    endpointId: ep2.id,
    position: { x: 750, y: 550 },
  });

  // 5. Model Nodes on Canvas
  const pagedNodeId = uid('n_');
  board.nodes.push({
    id: pagedNodeId,
    kind: 'model',
    modelId: pagedModel.id,
    position: { x: 340, y: 840 },
  });

  const taetigkeitNodeId = uid('n_');
  board.nodes.push({
    id: taetigkeitNodeId,
    kind: 'model',
    modelId: taetigkeitModel.id,
    position: { x: 340, y: 1040 },
  });

  const taetigkeitInfoNodeId = uid('n_');
  board.nodes.push({
    id: taetigkeitInfoNodeId,
    kind: 'model',
    modelId: taetigkeitInfoModel.id,
    position: { x: 750, y: 780 },
  });

  const taetigkeitKriterienNodeId = uid('n_');
  board.nodes.push({
    id: taetigkeitKriterienNodeId,
    kind: 'model',
    modelId: taetigkeitKriterienModel.id,
    position: { x: 750, y: 980 },
  });

  // 6. Connect Edges
  board.edges.push(
    {
      id: uid('e_'),
      source: actionNodeId,
      target: ep1NodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      kind: 'flow',
      label: '',
    },
    {
      id: uid('e_'),
      source: ep1NodeId,
      target: pagedNodeId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      kind: 'response',
      label: '',
    },
    {
      id: uid('e_'),
      source: pagedNodeId,
      target: taetigkeitNodeId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      kind: 'response',
      label: 'positionen',
    },
    {
      id: uid('e_'),
      source: taetigkeitNodeId,
      target: ep2NodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      kind: 'flow',
      label: '',
    },
    {
      id: uid('e_'),
      source: ep2NodeId,
      target: taetigkeitInfoNodeId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      kind: 'response',
      label: '',
    },
    {
      id: uid('e_'),
      source: taetigkeitInfoNodeId,
      target: taetigkeitKriterienNodeId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      kind: 'response',
      label: 'kriterien',
    }
  );

  return project;
}
