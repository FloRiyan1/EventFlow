import { uid } from './ids';
import { SCHEMA_VERSION } from './schema';
import type { Board, ComponentDef, Endpoint, Field, HttpMethod, Lane, Model, Project } from './schema';

export function createLanes(): Lane[] {
  return [
    { id: uid('l_'), name: 'User Actions', color: '#FFC21A', height: 520, kind: 'ui' },
    { id: uid('l_'), name: 'API', color: '#1E9BFF', height: 280, kind: 'api' },
    { id: uid('l_'), name: 'Model', color: '#FF9F1C', height: 600, kind: 'model' },
  ];
}

export function createBoard(name = 'Neuer Flow'): Board {
  return { id: uid('b_'), name, lanes: createLanes(), nodes: [], edges: [] };
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

/** Returns `base`, or `base2`, `base3`, ... if the name is already taken. */
export function uniqueName(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  let name = base;
  let i = 2;
  while (taken.has(name)) name = `${base}${i++}`;
  return name;
}
