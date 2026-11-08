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

export function createModel(name: string, fields: Field[] = []): Model {
  return { id: uid('m_'), name, description: '', fields };
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
