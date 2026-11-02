import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  projectToDoc,
  projectFromDoc,
  CollaborationManager,
  generateFriendlyRoomName,
  getRandomColor,
} from './collaboration';
import { createEmptyProject, createModel, createEndpoint } from './factory';
import { fieldsFromText } from './fields';
import type { FlowNode } from './schema';

describe('Collaboration CRDT & Sync', () => {
  it('generates friendly room names and preset colors', () => {
    const room = generateFriendlyRoomName();
    expect(room).toMatch(/^eventflow-[a-z]+-[a-z]+-\d{3}$/);

    const color = getRandomColor();
    expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('serializes and reconstructs a project from Y.Doc', () => {
    const project = createEmptyProject('Multiplayer Test');
    const model = createModel('CustomerModel', fieldsFromText('String id\nString name'));
    const ep = createEndpoint('POST', '/api/customer');
    project.models.push(model);
    project.endpoints.push(ep);

    const board = project.boards[0];
    const node: FlowNode = {
      id: 'n_test_1',
      kind: 'userAction',
      position: { x: 150, y: 220 },
      text: 'Button Clicked',
    };
    board.nodes.push(node);

    const doc = new Y.Doc();
    projectToDoc(doc, project);

    const reconstructed = projectFromDoc(doc);
    expect(reconstructed.name).toBe('Multiplayer Test');
    expect(reconstructed.models).toHaveLength(1);
    expect(reconstructed.models[0].name).toBe('CustomerModel');
    expect(reconstructed.endpoints).toHaveLength(1);
    expect(reconstructed.endpoints[0].path).toBe('/api/customer');

    expect(reconstructed.boards).toHaveLength(1);
    expect(reconstructed.boards[0].nodes).toHaveLength(1);
    expect(reconstructed.boards[0].nodes[0].id).toBe('n_test_1');
    expect(reconstructed.boards[0].nodes[0].position).toEqual({ x: 150, y: 220 });
  });

  it('merges simultaneous edits on different nodes conflict-free', () => {
    const project = createEmptyProject('Merge Test');
    const board = project.boards[0];
    const node1: FlowNode = {
      id: 'node_1',
      kind: 'userAction',
      position: { x: 10, y: 10 },
      text: 'Action 1',
    };
    const node2: FlowNode = {
      id: 'node_2',
      kind: 'userAction',
      position: { x: 50, y: 50 },
      text: 'Action 2',
    };
    board.nodes.push(node1, node2);

    // Peer A doc and Peer B doc start with the same project
    const docA = new Y.Doc();
    projectToDoc(docA, project);

    const docB = new Y.Doc();
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // Peer A moves node1
    const projectA = projectFromDoc(docA);
    const n1 = projectA.boards[0].nodes.find((n) => n.id === 'node_1')!;
    n1.position = { x: 999, y: 888 };
    projectToDoc(docA, projectA);

    // Peer B simultaneously moves node2
    const projectB = projectFromDoc(docB);
    const n2 = projectB.boards[0].nodes.find((n) => n.id === 'node_2')!;
    n2.position = { x: 777, y: 666 };
    projectToDoc(docB, projectB);

    // Sync updates both ways
    const svA = Y.encodeStateVector(docA);
    const svB = Y.encodeStateVector(docB);
    const updateFromA = Y.encodeStateAsUpdate(docA, svB);
    const updateFromB = Y.encodeStateAsUpdate(docB, svA);

    Y.applyUpdate(docA, updateFromB);
    Y.applyUpdate(docB, updateFromA);

    // Both docs now have both node movements!
    const resultA = projectFromDoc(docA);
    const resultB = projectFromDoc(docB);

    const n1InA = resultA.boards[0].nodes.find((n) => n.id === 'node_1');
    const n2InA = resultA.boards[0].nodes.find((n) => n.id === 'node_2');
    const n1InB = resultB.boards[0].nodes.find((n) => n.id === 'node_1');
    const n2InB = resultB.boards[0].nodes.find((n) => n.id === 'node_2');

    expect(n1InA?.position).toEqual({ x: 999, y: 888 });
    expect(n2InA?.position).toEqual({ x: 777, y: 666 });
    expect(n1InB?.position).toEqual({ x: 999, y: 888 });
    expect(n2InB?.position).toEqual({ x: 777, y: 666 });
  });

  it('manages local user state and status notifications', () => {
    const manager = new CollaborationManager({
      name: 'Flo Tester',
      color: '#2563EB',
    });

    expect(manager.getUser().name).toBe('Flo Tester');
    expect(manager.getUser().color).toBe('#2563EB');

    let latestStatus = manager.getStatus();
    const unsub = manager.subscribe((status) => {
      latestStatus = status;
    });

    manager.setUser({ name: 'Florian Updated' });
    expect(latestStatus.self.name).toBe('Florian Updated');
    expect(latestStatus.connected).toBe(false);

    unsub();
    manager.destroy();
  });
});
