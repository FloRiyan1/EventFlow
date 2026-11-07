import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  createEndpoint,
  createModel,
  fieldsFromText,
  parseFieldLine,
  referencedTypeNames,
  renameTypeInExpr,
  createEditorStore,
  connect,
  renameModel,
  removeNodes,
  removeEdges,
  triggerHandleId,
  projectToZip,
  projectFromZip,
  exportBoardToPlantUml,
  exportModelsToPlantUml,
  getModelHierarchyInfo,
  insertModelWithSubModels,
  insertSubModelsForNode,
  reorderModelField,
  sortModelFields,
  parsePlantUml,
  importPlantUmlIntoProject,
  calculateAlignmentSnap,
  snapToGridValue,
  alignNodes,
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
      { id: 'e1', kind: 'trigger', source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null, label: '' },
      { id: 'e2', kind: 'response', source: 'n2', target: 'n3', sourceHandle: null, targetHandle: null, label: '' }
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
      { id: 'e1', kind: 'trigger', source: 'n1', target: 'n2', sourceHandle: 'out1', targetHandle: 'in1', label: '' },
      { id: 'e2', kind: 'trigger', source: 'n1', target: 'n2', sourceHandle: 'out2', targetHandle: 'in2', label: '' }
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
        width: 240,
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

describe('PlantUML Export', () => {
  it('exports board to PlantUML with nodes and edges', () => {
    const project = createEmptyProject('PlantUML Test');
    const board = project.boards[0];
    const model = createModel('Customer', [{ id: 'f1', name: 'name', type: 'String', nullable: false }]);
    const endpoint = createEndpoint('POST', '/api/v1/customer');
    project.models.push(model);
    project.endpoints.push(endpoint);

    board.nodes.push(
      { id: 'n_m1', kind: 'model', modelId: model.id, position: { x: 0, y: 0 } },
      { id: 'n_ep1', kind: 'endpoint', endpointId: endpoint.id, position: { x: 200, y: 0 } }
    );
    board.edges.push({
      id: 'e1',
      source: 'n_ep1',
      target: 'n_m1',
      sourceHandle: null,
      targetHandle: null,
      kind: 'response',
      label: 'response',
    });

    const puml = exportBoardToPlantUml(project, board);
    expect(puml).toContain('@startuml');
    expect(puml).toContain('title EventFlow -');
    expect(puml).toContain('rectangle "<b>Model: Customer</b>');
    expect(puml).toContain('API: POST');
    expect(puml).toContain('node_n_ep1 --> node_n_m1 : response');
    // Ensure no class { } in component diagram (which causes PlantUML syntax error)
    expect(puml).not.toContain('class "Customer" as');
    expect(puml).toContain('@enduml');
  });

  it('exports all node types (screen, action, endpoint, model, flowRef, note) to valid component PUML', () => {
    const project = createEmptyProject('All Nodes PUML');
    const board = project.boards[0];
    const model = createModel('Product', [{ id: 'f1', name: 'sku', type: 'String', nullable: false }]);
    const endpoint = createEndpoint('GET', '/api/v1/products');
    project.models.push(model);
    project.endpoints.push(endpoint);

    board.nodes.push(
      { id: 'n_sc', kind: 'screen', title: 'Main View', assetId: 'a1', width: 240, hotspots: [], position: { x: 0, y: 0 } },
      { id: 'n_act', kind: 'userAction', label: 'Click Button', position: { x: 100, y: 0 } },
      { id: 'n_ep', kind: 'endpoint', endpointId: endpoint.id, position: { x: 200, y: 0 } },
      { id: 'n_mo', kind: 'model', modelId: model.id, position: { x: 300, y: 0 } },
      { id: 'n_ref', kind: 'flowRef', targetBoardId: 'other_b', label: 'Sub Process', position: { x: 400, y: 0 } },
      { id: 'n_not', kind: 'note', text: 'Important Note', position: { x: 500, y: 0 } }
    );

    const puml = exportBoardToPlantUml(project, board);
    expect(puml).toContain('rectangle "<b>Screen</b>\\nMain View"');
    expect(puml).toContain('rectangle "<b>Action</b>\\nClick Button"');
    expect(puml).toContain('rectangle "<b>API: GET</b>\\n/api/v1/products"');
    expect(puml).toContain('rectangle "<b>Model: Product</b>\\n..\\nFields:\\n• sku: String"');
    expect(puml).toContain('rectangle "<b>Sub-Flow</b>\\nSub Process"');
    expect(puml).toContain('note as node_n_not');
  });

  it('exports models to PlantUML class diagram with associations', () => {
    const project = createEmptyProject('Models PUML');
    const item = createModel('Item', [{ id: 'f1', name: 'id', type: 'int', nullable: false }]);
    const order = createModel('Order', [
      { id: 'f2', name: 'title', type: 'String', nullable: false },
      { id: 'f3', name: 'items', type: 'List<Item>', nullable: false },
    ]);
    project.models.push(item, order);

    const puml = exportModelsToPlantUml(project);
    expect(puml).toContain('@startuml');
    expect(puml).toContain('class "Item" as node_');
    expect(puml).toContain('class "Order" as node_');
    expect(puml).toContain('*-- "*"');
    expect(puml).toContain(': items');
    expect(puml).toContain('@enduml');
  });

  it('correctly determines root and sub-models with hierarchy info', () => {
    const project = createEmptyProject('Hierarchy Test');
    const child = createModel('Child', [{ id: 'c1', name: 'id', type: 'String', nullable: false }]);
    const parent = createModel('Parent', [
      { id: 'p1', name: 'childList', type: 'List<Child>', nullable: false },
    ]);
    project.models.push(child, parent);

    const parentInfo = getModelHierarchyInfo(project, parent.id);
    expect(parentInfo.isRoot).toBe(true);
    expect(parentInfo.subModels).toHaveLength(1);
    expect(parentInfo.subModels[0].model.name).toBe('Child');

    const childInfo = getModelHierarchyInfo(project, child.id);
    expect(childInfo.isRoot).toBe(false);
    expect(childInfo.parentModels).toHaveLength(1);
    expect(childInfo.parentModels[0].name).toBe('Parent');
  });

  it('inserts model together with all its sub-models and connects them with flow edges', () => {
    const project = createEmptyProject('Insert Submodels Test');
    const board = project.boards[0];
    const subSub = createModel('GrandChild', [{ id: 'gc1', name: 'id', type: 'String', nullable: false }]);
    const sub = createModel('Child', [
      { id: 'c1', name: 'name', type: 'String', nullable: false },
      { id: 'c2', name: 'gc', type: 'GrandChild', nullable: false },
    ]);
    const root = createModel('Parent', [
      { id: 'p1', name: 'children', type: 'List<Child>', nullable: false },
    ]);
    project.models.push(subSub, sub, root);

    const result = insertModelWithSubModels(board, project, root.id, {
      basePosition: { x: 100, y: 500 },
      spacingX: 300,
      spacingY: 200,
    });

    expect(result.createdNodeIds).toHaveLength(3); // Parent, Child, GrandChild
    expect(board.nodes).toHaveLength(3);
    expect(board.edges).toHaveLength(2); // Parent -> Child, Child -> GrandChild

    // Verify parent node
    const parentNode = board.nodes.find((n) => n.id === result.rootNodeId);
    expect(parentNode?.position).toEqual({ x: 100, y: 500 });

    // Verify edge labels
    const childEdge = board.edges.find((e) => e.source === result.rootNodeId);
    expect(childEdge?.label).toBe('children');

    const grandChildNode = board.nodes.find((n) => n.kind === 'model' && n.modelId === subSub.id);
    expect(grandChildNode).toBeDefined();
  });

  it('inserts sub-models for an existing model node on board', () => {
    const project = createEmptyProject('Existing Node Submodels Test');
    const board = project.boards[0];
    const sub = createModel('Child', [{ id: 'c1', name: 'code', type: 'String', nullable: false }]);
    const root = createModel('Parent', [
      { id: 'p1', name: 'childRef', type: 'Child', nullable: false },
    ]);
    project.models.push(sub, root);

    // Parent is already on board
    board.nodes.push({
      id: 'existing_parent_node',
      kind: 'model',
      modelId: root.id,
      position: { x: 200, y: 300 },
    });

    const result = insertSubModelsForNode(board, project, 'existing_parent_node');
    expect(result.createdNodeIds).toHaveLength(1);
    expect(result.createdEdgeIds).toHaveLength(1);
    expect(board.nodes).toHaveLength(2);
    expect(board.edges[0].label).toBe('childRef');
  });

  it('reorders model fields correctly', () => {
    const model = createModel('TestModel', [
      { id: 'f1', name: 'alpha', type: 'String', nullable: false },
      { id: 'f2', name: 'beta', type: 'int', nullable: false },
      { id: 'f3', name: 'gamma', type: 'bool', nullable: false },
    ]);

    reorderModelField(model, 2, 0); // Move gamma to front
    expect(model.fields.map((f) => f.name)).toEqual(['gamma', 'alpha', 'beta']);

    reorderModelField(model, 1, 2); // Move alpha to end
    expect(model.fields.map((f) => f.name)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('sorts model fields by criteria', () => {
    const project = createEmptyProject();
    const sub = createModel('SubItem', [{ id: 's1', name: 'id', type: 'int', nullable: false }]);
    project.models.push(sub);

    const model = createModel('Article', [
      { id: '1', name: 'title', type: 'String', nullable: true },
      { id: '2', name: 'id', type: 'int', nullable: false },
      { id: '3', name: 'subItem', type: 'SubItem', nullable: true },
      { id: '4', name: 'active', type: 'bool', nullable: false },
    ]);

    // Name ascending (A-Z)
    sortModelFields(project, model, 'name-asc');
    expect(model.fields.map((f) => f.name)).toEqual(['active', 'id', 'subItem', 'title']);

    // Name descending (Z-A)
    sortModelFields(project, model, 'name-desc');
    expect(model.fields.map((f) => f.name)).toEqual(['title', 'subItem', 'id', 'active']);

    // Type ascending (bool, int, String, SubItem)
    sortModelFields(project, model, 'type-asc');
    expect(model.fields.map((f) => f.type)).toEqual(['bool', 'int', 'String', 'SubItem']);

    // Required first (nullable: false first)
    sortModelFields(project, model, 'required-first');
    expect(model.fields.map((f) => f.name)).toEqual(['active', 'id', 'subItem', 'title']);

    // Submodels first
    sortModelFields(project, model, 'submodels-first');
    expect(model.fields[0].name).toBe('subItem');
  });

  describe('PlantUML Import', () => {
    it('parses PlantUML class diagrams into models with fields', () => {
      const puml = `
@startuml
title My Models
class "Customer" as node_cust {
  +id: int
  +name: String
  -email: String?
  orders: List<Order>
}
class Order {
  String uuid
  double total
}
node_cust "1" *-- "*" Order : orders
@enduml
      `;

      const parsed = parsePlantUml(puml);
      expect(parsed.title).toBe('My Models');
      expect(parsed.models).toHaveLength(2);

      const cust = parsed.models.find((m) => m.name === 'Customer');
      expect(cust).toBeDefined();
      expect(cust?.fields).toHaveLength(4);
      expect(cust?.fields[0]).toEqual({ name: 'id', type: 'int', nullable: false });
      expect(cust?.fields[2]).toEqual({ name: 'email', type: 'String', nullable: true });
      expect(cust?.fields[3]).toEqual({ name: 'orders', type: 'List<Order>', nullable: false });

      const ord = parsed.models.find((m) => m.name === 'Order');
      expect(ord).toBeDefined();
      expect(ord?.fields).toHaveLength(2);
      expect(ord?.fields[0]).toEqual({ name: 'uuid', type: 'String', nullable: false });
      expect(ord?.fields[1]).toEqual({ name: 'total', type: 'double', nullable: false });

      expect(parsed.edges).toHaveLength(1);
      expect(parsed.edges[0].label).toBe('orders');
    });

    it('parses PlantUML flow architecture diagrams (Screens, Actions, Endpoints, Notes)', () => {
      const puml = `
@startuml
title EventFlow - Order Flow
rectangle "<b>Action</b>\\nPress Submit" as n_action #FEF9C3
rectangle "<b>API: POST</b>\\n/api/orders\\n..\\nParams:\\n• customerId: int\\n• note: String?" as n_api #E0F2FE
rectangle "<b>Screen</b>\\nOrder Overview\\n..\\nHotspots:\\n• Details Button (onTap)" as n_screen #FEF3C7
note as n_note
Check inventory before calling API
end note

n_action --> n_api : triggers
n_api --> n_screen : success
@enduml
      `;

      const parsed = parsePlantUml(puml);
      expect(parsed.title).toBe('Order Flow');
      expect(parsed.nodes).toHaveLength(4); // action, api, screen, note

      const action = parsed.nodes.find((n) => n.kind === 'userAction');
      expect(action?.label).toBe('Press Submit');

      const ep = parsed.nodes.find((n) => n.kind === 'endpoint');
      expect(ep?.endpointData?.method).toBe('POST');
      expect(ep?.endpointData?.path).toBe('/api/orders');
      expect(ep?.endpointData?.params).toHaveLength(2);

      const screen = parsed.nodes.find((n) => n.kind === 'screen');
      expect(screen?.screenTitle).toBe('Order Overview');
      expect(screen?.hotspots).toHaveLength(1);
      expect(screen?.hotspots?.[0]).toEqual({ label: 'Details Button', event: 'onTap' });

      const note = parsed.nodes.find((n) => n.kind === 'note');
      expect(note?.noteText).toContain('Check inventory');

      expect(parsed.edges).toHaveLength(2);
    });

    it('imports PlantUML into project creating models, endpoints, and flow board', () => {
      const project = createEmptyProject('Empty Project');
      const puml = `
@startuml
title Checkout
rectangle "<b>Action</b>\\nPay Now" as n1 #FEF9C3
rectangle "<b>API: POST</b>\\n/checkout" as n2 #E0F2FE
class "Receipt" as n3 {
  +id: String
  +amount: double
}
n1 --> n2 : submit
n2 --> n3 : returns
@enduml
      `;

      const parsed = parsePlantUml(puml);
      const stats = importPlantUmlIntoProject(project, parsed, {
        targetBoardId: 'new',
        newBoardName: 'Checkout Board',
      });

      expect(stats.createdModels).toHaveLength(1);
      expect(project.models.some((m) => m.name === 'Receipt')).toBe(true);

      expect(stats.createdEndpoints).toHaveLength(1);
      expect(project.endpoints.some((e) => e.path === '/checkout')).toBe(true);

      const board = project.boards.find((b) => b.name === 'Checkout Board');
      expect(board).toBeDefined();
      expect(board?.nodes.length).toBeGreaterThanOrEqual(2);
      expect(board?.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('successfully round-trips PlantUML export and import for data models', () => {
      const p1 = createEmptyProject('P1');
      const address = createModel('AddressModel', [
        { id: 'f1', name: 'street', type: 'String', nullable: false },
        { id: 'f2', name: 'zip', type: 'int', nullable: false },
      ]);
      const user = createModel('UserModel', [
        { id: 'f3', name: 'name', type: 'String', nullable: false },
        { id: 'f4', name: 'address', type: 'AddressModel', nullable: true },
      ]);
      p1.models.push(address, user);

      // Export to PlantUML
      const exportedPuml = exportModelsToPlantUml(p1);

      // Import back into fresh project
      const p2 = createEmptyProject('P2');
      const parsed = parsePlantUml(exportedPuml);
      importPlantUmlIntoProject(p2, parsed);

      expect(p2.models).toHaveLength(2);
      const importedAddress = p2.models.find((m) => m.name === 'AddressModel');
      expect(importedAddress?.fields).toHaveLength(2);
      const importedUser = p2.models.find((m) => m.name === 'UserModel');
      expect(importedUser?.fields).toHaveLength(2);
      expect(importedUser?.fields.find((f) => f.name === 'address')?.type).toBe('AddressModel');
      expect(importedUser?.fields.find((f) => f.name === 'address')?.nullable).toBe(true);
    });
  });

  describe('Alignment and Snapping', () => {
    it('snaps dragged node to center alignment of target node', () => {
      // Node A is at (100, 100), width 200, height 100 => centerX = 200, centerY = 150
      const nodeA = {
        id: 'nodeA',
        position: { x: 100, y: 100 },
        width: 200,
        height: 100,
      };

      // Node B has width 100, height 50.
      // If placed at x=148, centerX = 148 + 50 = 198 (2px away from nodeA's centerX 200)
      const nodeB = {
        id: 'nodeB',
        position: { x: 148, y: 300 },
        width: 100,
        height: 50,
      };

      const result = calculateAlignmentSnap(nodeB, [nodeA], 8);
      // Snapped position should be 200 - 50 = 150
      expect(result.x).toBe(150);
      expect(result.verticalLine).toBeDefined();
      expect(result.verticalLine?.type).toBe('vertical');
      expect(result.verticalLine?.coordinate).toBe(200);
      expect(result.verticalLine?.snapType).toBe('center');
      expect(result.verticalLine?.targetNodeId).toBe('nodeA');
    });

    it('snaps horizontal center when moving vertically', () => {
      // Node A is at (100, 100), height 100 => centerY = 150
      const nodeA = {
        id: 'nodeA',
        position: { x: 100, y: 100 },
        width: 200,
        height: 100,
      };

      // Node B has height 60 => half is 30.
      // Placed at y=122 => centerY = 122 + 30 = 152 (2px away from 150)
      const nodeB = {
        id: 'nodeB',
        position: { x: 400, y: 122 },
        width: 100,
        height: 60,
      };

      const result = calculateAlignmentSnap(nodeB, [nodeA], 8);
      // Snapped position should be 150 - 30 = 120
      expect(result.y).toBe(120);
      expect(result.horizontalLine).toBeDefined();
      expect(result.horizontalLine?.coordinate).toBe(150);
      expect(result.horizontalLine?.snapType).toBe('center');
    });

    it('does not snap if outside snapDistance', () => {
      const nodeA = {
        id: 'nodeA',
        position: { x: 100, y: 100 },
        width: 200,
        height: 100,
      };

      const nodeB = {
        id: 'nodeB',
        position: { x: 500, y: 500 },
        width: 100,
        height: 50,
      };

      const result = calculateAlignmentSnap(nodeB, [nodeA], 8);
      expect(result.x).toBe(500);
      expect(result.y).toBe(500);
      expect(result.verticalLine).toBeNull();
      expect(result.horizontalLine).toBeNull();
    });

    it('correctly rounds to grid increments with snapToGridValue', () => {
      expect(snapToGridValue(23, 20)).toBe(20);
      expect(snapToGridValue(31, 20)).toBe(40);
      expect(snapToGridValue(15, 16)).toBe(16);
      expect(snapToGridValue(7, 16)).toBe(0);
    });

    it('aligns multiple nodes along horizontal center', () => {
      const nodes = [
        { id: '1', position: { x: 100, y: 50 }, width: 200, height: 100 }, // centerX = 200
        { id: '2', position: { x: 300, y: 200 }, width: 100, height: 50 }, // centerX = 350
      ];
      // Avg centerX = (200 + 350) / 2 = 275
      const aligned = alignNodes(nodes, 'centerH');
      expect(aligned).toHaveLength(2);
      expect(aligned[0].position.x).toBe(275 - 100); // 175
      expect(aligned[1].position.x).toBe(275 - 50); // 225
      // Y positions are unchanged
      expect(aligned[0].position.y).toBe(50);
      expect(aligned[1].position.y).toBe(200);
    });

    it('aligns multiple nodes along vertical center', () => {
      const nodes = [
        { id: '1', position: { x: 50, y: 100 }, width: 100, height: 200 }, // centerY = 200
        { id: '2', position: { x: 300, y: 350 }, width: 100, height: 100 }, // centerY = 400
      ];
      // Avg centerY = (200 + 400) / 2 = 300
      const aligned = alignNodes(nodes, 'centerV');
      expect(aligned).toHaveLength(2);
      expect(aligned[0].position.y).toBe(300 - 100); // 200
      expect(aligned[1].position.y).toBe(300 - 50); // 250
      // X positions are unchanged
      expect(aligned[0].position.x).toBe(50);
      expect(aligned[1].position.x).toBe(300);
    });
  });
});




