import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createEmptyProject,
  createEndpoint,
  createModel,
  fieldsFromText,
  fieldsToText,
  formatParam,
  parseFieldLine,
  parseFieldsText,
  referencedTypeNames,
  renameTypeInExpr,
  createEditorStore,
  connect,
  renameModel,
  deleteModel,
  ensureModelsForFields,
  removeNodes,
  removeEdges,
  triggerHandleId,
  projectToZip,
  projectFromZip,
  SCHEMA_VERSION,
} from './index';

describe('Field Parser', () => {
  it('parses Dart-style fields with nullable and generics', () => {
    expect(parseFieldLine('String uuid')).toEqual({
      name: 'uuid',
      type: 'String',
      nullable: false,
    });

    expect(parseFieldLine('String? nummer')).toEqual({
      name: 'nummer',
      type: 'String',
      nullable: true,
    });

    expect(parseFieldLine('List<PositionRESTModel> positionen')).toEqual({
      name: 'positionen',
      type: 'List<PositionRESTModel>',
      nullable: false,
    });

    expect(parseFieldLine('double? preis')).toEqual({
      name: 'preis',
      type: 'double',
      nullable: true,
    });

    expect(parseFieldLine('bool hasErfassungen')).toEqual({
      name: 'hasErfassungen',
      type: 'bool',
      nullable: false,
    });
  });

  it('parses endpoint parameters with + prefix for required', () => {
    expect(parseFieldLine('+String taetigkeitUuid')).toEqual({
      name: 'taetigkeitUuid',
      type: 'String',
      nullable: false,
    });

    expect(parseFieldLine('bool? unvollstaendig')).toEqual({
      name: 'unvollstaendig',
      type: 'bool',
      nullable: true,
    });

    expect(parseFieldLine('+ int page')).toEqual({
      name: 'page',
      type: 'int',
      nullable: false,
    });
  });

  it('parses multi-line text into fields and preserves stability', () => {
    const text = `
      String uuid
      String? name
      List<ItemModel> items
    `;
    const fields = fieldsFromText(text);
    expect(fields).toHaveLength(3);
    expect(fields[0].name).toBe('uuid');
    expect(fields[1].nullable).toBe(true);
    expect(fields[2].type).toBe('List<ItemModel>');

    // Stable IDs when updating text
    const updated = fieldsFromText(text + '\nString description', fields);
    expect(updated[0].id).toBe(fields[0].id);
    expect(updated[3].name).toBe('description');
  });

  it('extracts non-primitive referenced type names', () => {
    expect(referencedTypeNames('List<PositionRESTModel>')).toEqual(['PositionRESTModel']);
    expect(referencedTypeNames('Map<String, UserProfile>')).toEqual(['UserProfile']);
    expect(referencedTypeNames('String')).toEqual([]);
    expect(referencedTypeNames('int')).toEqual([]);
  });

  it('renames types correctly inside generics', () => {
    expect(renameTypeInExpr('List<OldModel>', 'OldModel', 'NewModel')).toBe('List<NewModel>');
    expect(renameTypeInExpr('OldModel', 'OldModel', 'NewModel')).toBe('NewModel');
    expect(renameTypeInExpr('List<OldModelSpecial>', 'OldModel', 'NewModel')).toBe('List<OldModelSpecial>');
  });
});

describe('Domain Operations & Store', () => {
  it('creates an empty project with 3 default lanes (User Actions, API, Model)', () => {
    const project = createEmptyProject('Test Projekt');
    expect(project.boards).toHaveLength(1);
    const lanes = project.boards[0].lanes;
    expect(lanes.map((l) => l.name)).toEqual(['User Actions', 'API', 'Model']);
    expect(lanes.map((l) => l.kind)).toEqual(['ui', 'api', 'model']);
  });

  it('handles undo and redo with snapshots', () => {
    const project = createEmptyProject();
    const store = createEditorStore(project);

    store.update((draft) => {
      draft.models.push(createModel('FirstModel'));
    });
    expect(store.getState().project.models).toHaveLength(1);

    store.update((draft) => {
      draft.models.push(createModel('SecondModel'));
    });
    expect(store.getState().project.models).toHaveLength(2);

    store.undo();
    expect(store.getState().project.models).toHaveLength(1);
    expect(store.getState().project.models[0].name).toBe('FirstModel');

    store.redo();
    expect(store.getState().project.models).toHaveLength(2);
  });

  it('propagates model renames across other model fields and endpoints', () => {
    const project = createEmptyProject();
    const m1 = createModel('ItemModel');
    const m2 = createModel('ContainerModel', [
      { id: 'f1', name: 'items', type: 'List<ItemModel>', nullable: false },
    ]);
    const ep = createEndpoint('GET', '/items');
    ep.params = [{ id: 'p1', name: 'filter', type: 'ItemModel', nullable: true }];

    project.models = [m1, m2];
    project.endpoints = [ep];

    renameModel(project, m1.id, 'RenamedItem');
    expect(project.models[0].name).toBe('RenamedItem');
    expect(project.models[1].fields[0].type).toBe('List<RenamedItem>');
    expect(project.endpoints[0].params[0].type).toBe('RenamedItem');
  });

  it('removes multiple nodes and their connected edges atomically', () => {
    const project = createEmptyProject();
    const board = project.boards[0];
    board.nodes.push(
      { id: 'n1', kind: 'userAction', label: 'Action 1', position: { x: 0, y: 0 } },
      { id: 'n2', kind: 'endpoint', endpointId: 'ep1', position: { x: 100, y: 100 } },
      { id: 'n3', kind: 'model', modelId: 'm1', position: { x: 200, y: 200 } }
    );
    board.edges.push(
      { id: 'e1', kind: 'trigger', source: 'n1', target: 'n2' },
      { id: 'e2', kind: 'response', source: 'n2', target: 'n3' }
    );

    // Remove n1 and n2 simultaneously
    removeNodes(board, new Set(['n1', 'n2']));
    expect(board.nodes).toHaveLength(1);
    expect(board.nodes[0].id).toBe('n3');
    // Both edges connected to n1 and n2 must be purged
    expect(board.edges).toHaveLength(0);
  });

  it('removes specific edges by id without affecting other edges or nodes', () => {
    const project = createEmptyProject();
    const board = project.boards[0];
    board.nodes.push(
      { id: 'n1', kind: 'userAction', label: 'Action 1', position: { x: 0, y: 0 } },
      { id: 'n2', kind: 'endpoint', endpointId: 'ep1', position: { x: 100, y: 100 } }
    );
    board.edges.push(
      { id: 'e1', kind: 'trigger', source: 'n1', target: 'n2', sourceHandle: 'out1', targetHandle: 'in1' },
      { id: 'e2', kind: 'trigger', source: 'n1', target: 'n2', sourceHandle: 'out2', targetHandle: 'in2' }
    );

    removeEdges(board, new Set(['e1']));
    expect(board.edges).toHaveLength(1);
    expect(board.edges[0].id).toBe('e2');
    expect(board.nodes).toHaveLength(2);
  });

  it('allows connecting distinct row handles between the same two nodes', () => {
    const project = createEmptyProject();
    const board = project.boards[0];
    board.nodes.push(
      { id: 'm1', kind: 'model', modelId: 'model1', position: { x: 0, y: 0 } },
      { id: 'ep1', kind: 'endpoint', endpointId: 'endpoint1', position: { x: 200, y: 200 } }
    );

    const edge1 = connect(project, board, {
      source: 'm1',
      target: 'ep1',
      sourceHandle: 'field-out-f1',
      targetHandle: 'param-in-p1',
    });
    const edge2 = connect(project, board, {
      source: 'm1',
      target: 'ep1',
      sourceHandle: 'field-out-f2',
      targetHandle: 'param-in-p2',
    });

    expect(edge1).not.toBeNull();
    expect(edge2).not.toBeNull();
    expect(board.edges).toHaveLength(2);
  });

  it('connects a screen hotspot trigger to an endpoint and automatically assigns trigger kind and label', () => {
    const project = createEmptyProject();
    const board = project.boards[0];
    const triggerId = 'trig1';
    board.nodes.push(
      {
        id: 'screen1',
        kind: 'screen',
        title: 'Login Screen',
        assetId: 'a1',
        position: { x: 0, y: 0 },
        hotspots: [
          {
            id: 'h1',
            label: 'Login Button',
            rect: { x: 0.1, y: 0.8, w: 0.8, h: 0.1 },
            triggers: [{ id: triggerId, event: 'onTap', condition: 'isValid == true' }],
          },
        ],
      },
      { id: 'ep1', kind: 'endpoint', endpointId: 'ep_login', position: { x: 300, y: 0 } }
    );

    const edge = connect(project, board, {
      source: 'screen1',
      target: 'ep1',
      sourceHandle: triggerHandleId(triggerId),
      targetHandle: 'left',
    });

    expect(edge).not.toBeNull();
    expect(edge?.kind).toBe('trigger');
    expect(edge?.label).toBe('onTap: Login Button [isValid == true]');
    expect(board.edges).toHaveLength(1);
  });
});

describe('Project File (ZIP format)', () => {
  it('serializes to ZIP and deserializes with data intact', async () => {
    const project = createEmptyProject('Zip Test');
    project.models.push(createModel('TestModel', [{ id: 'f1', name: 'id', type: 'String', nullable: false }]));
    project.assets['a1'] = {
      id: 'a1',
      mime: 'image/png',
      width: 100,
      height: 100,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=',
    };

    const zipData = await projectToZip(project);
    expect(zipData.length).toBeGreaterThan(0);

    const loaded = await projectFromZip(zipData);
    expect(loaded.name).toBe('Zip Test');
    expect(loaded.models).toHaveLength(1);
    expect(loaded.assets['a1']).toBeDefined();
    expect(loaded.assets['a1'].dataUrl).toContain('data:image/png;base64,');
  });
});
