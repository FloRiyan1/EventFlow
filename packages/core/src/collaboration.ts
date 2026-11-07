import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import type { EditorStore } from './store';
import type { Project, Model, Endpoint, ComponentDef, Asset, FlowNode, FlowEdge, Board } from './schema';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
}

export interface CanvasPing {
  x: number;
  y: number;
  timestamp: number;
  boardId?: string;
}

export interface CollaborationPeerState {
  clientId: number;
  user: CollaborationUser;
  cursor: { x: number; y: number } | null;
  selection?: string[];
  activeBoardId?: string;
  ping?: CanvasPing | null;
}

export interface CollaborationStatus {
  roomName: string | null;
  connected: boolean;
  isSynced: boolean;
  peers: CollaborationPeerState[];
  self: CollaborationUser;
}

export interface JoinRoomOptions {
  roomName: string;
  user: CollaborationUser;
  signalingUrls?: string[];
  password?: string;
}

const DEFAULT_SIGNALING_URLS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com',
];

export const PRESET_AVATAR_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Purple
  '#E11D48', // Rose
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#4F46E5', // Indigo
];

export function getRandomColor(): string {
  return PRESET_AVATAR_COLORS[Math.floor(Math.random() * PRESET_AVATAR_COLORS.length)];
}

export function generateFriendlyRoomName(): string {
  const adjectives = ['swift', 'agile', 'bright', 'cyber', 'flow', 'hyper', 'zen', 'matrix', 'nova', 'sync'];
  const nouns = ['team', 'sprint', 'board', 'canvas', 'hub', 'space', 'craft', 'flow', 'nexus', 'room'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `eventflow-${adj}-${noun}-${num}`;
}

function clone<T>(val: T): T {
  if (val === undefined || val === null) return val;
  return JSON.parse(JSON.stringify(val));
}

/**
 * Reconstructs a full Project object from a Y.Doc structure.
 */
export function projectFromDoc(doc: Y.Doc, fallbackProject?: Project): Project {
  const metaMap = doc.getMap('meta');
  const modelsMap = doc.getMap<Model>('models');
  const endpointsMap = doc.getMap<Endpoint>('endpoints');
  const componentsMap = doc.getMap<ComponentDef>('components');
  const assetsMap = doc.getMap<Asset>('assets');
  const boardsMap = doc.getMap<any>('boards');
  const boardNodesMap = doc.getMap<FlowNode>('boardNodes');
  const boardEdgesMap = doc.getMap<FlowEdge>('boardEdges');

  const projectId = (metaMap.get('id') as string) || fallbackProject?.id || 'p_project';
  const projectName = (metaMap.get('name') as string) || fallbackProject?.name || 'Neues Projekt';

  // 1. Reconstruct models in order
  const modelOrder: string[] = (metaMap.get('modelOrder') as string[]) || [];
  const modelMap = new Map<string, Model>();
  modelsMap.forEach((model) => modelMap.set(model.id, clone(model)));
  const models: Model[] = [];
  for (const id of modelOrder) {
    const m = modelMap.get(id);
    if (m) {
      models.push(m);
      modelMap.delete(id);
    }
  }
  modelMap.forEach((m) => models.push(m));

  // 2. Reconstruct endpoints in order
  const endpointOrder: string[] = (metaMap.get('endpointOrder') as string[]) || [];
  const epMap = new Map<string, Endpoint>();
  endpointsMap.forEach((ep) => epMap.set(ep.id, clone(ep)));
  const endpoints: Endpoint[] = [];
  for (const id of endpointOrder) {
    const ep = epMap.get(id);
    if (ep) {
      endpoints.push(ep);
      epMap.delete(id);
    }
  }
  epMap.forEach((ep) => endpoints.push(ep));

  // 3. Components
  const components: ComponentDef[] = [];
  componentsMap.forEach((comp) => components.push(clone(comp)));

  // 4. Assets
  const assets: Record<string, Asset> = {};
  assetsMap.forEach((asset, key) => {
    assets[key] = clone(asset);
  });

  // 5. Boards
  const boardOrder: string[] = (metaMap.get('boardOrder') as string[]) || [];
  const boardMap = new Map<string, any>();
  boardsMap.forEach((boardMeta, boardId) => boardMap.set(boardId, clone(boardMeta)));

  const sortedBoardIds: string[] = [];
  for (const id of boardOrder) {
    if (boardMap.has(id)) {
      sortedBoardIds.push(id);
      boardMap.delete(id);
    }
  }
  boardMap.forEach((_, id) => sortedBoardIds.push(id));

  const boards: Board[] = [];
  for (const boardId of sortedBoardIds) {
    const boardMeta = boardsMap.get(boardId);
    if (!boardMeta) continue;

    const prefix = boardId + ':';

    // Reconstruct nodes in order
    const nodeOrder: string[] = boardMeta.nodeOrder || [];
    const nodeMap = new Map<string, FlowNode>();
    boardNodesMap.forEach((node, key) => {
      if (key.startsWith(prefix)) {
        nodeMap.set(node.id, clone(node));
      }
    });
    const nodes: FlowNode[] = [];
    for (const id of nodeOrder) {
      const node = nodeMap.get(id);
      if (node) {
        nodes.push(node);
        nodeMap.delete(id);
      }
    }
    nodeMap.forEach((node) => nodes.push(node));

    // Reconstruct edges in order
    const edgeOrder: string[] = boardMeta.edgeOrder || [];
    const edgeMap = new Map<string, FlowEdge>();
    boardEdgesMap.forEach((edge, key) => {
      if (key.startsWith(prefix)) {
        edgeMap.set(edge.id, clone(edge));
      }
    });
    const edges: FlowEdge[] = [];
    for (const id of edgeOrder) {
      const edge = edgeMap.get(id);
      if (edge) {
        edges.push(edge);
        edgeMap.delete(id);
      }
    }
    edgeMap.forEach((edge) => edges.push(edge));

    boards.push({
      id: boardId,
      name: boardMeta.name || 'Board',
      kind: boardMeta.kind || 'flow',
      nodes,
      edges,
      lanes: clone(boardMeta.lanes || []),
    });
  }

  if (boards.length === 0) {
    if (fallbackProject && fallbackProject.boards.length > 0) {
      boards.push(...fallbackProject.boards);
    } else {
      boards.push({ id: 'main', name: 'Board 1', kind: 'flow', nodes: [], edges: [], lanes: [] });
    }
  }

  return {
    schemaVersion: 1,
    id: projectId,
    name: projectName,
    models,
    endpoints,
    components,
    assets,
    boards,
  };
}

/**
 * Replicates a full Project into Y.Doc using granular key updates.
 */
export function projectToDoc(doc: Y.Doc, project: Project, origin: string = 'local'): void {
  doc.transact(() => {
    const metaMap = doc.getMap('meta');
    metaMap.set('id', project.id);
    metaMap.set('name', project.name);
    metaMap.set('schemaVersion', project.schemaVersion || 1);
    metaMap.set('modelOrder', project.models.map((m) => m.id));
    metaMap.set('endpointOrder', project.endpoints.map((ep) => ep.id));
    metaMap.set('boardOrder', project.boards.map((b) => b.id));

    // 1. Models
    const modelsMap = doc.getMap<Model>('models');
    const existingModelIds = new Set(modelsMap.keys());
    for (const model of project.models) {
      existingModelIds.delete(model.id);
      const current = modelsMap.get(model.id);
      if (JSON.stringify(current) !== JSON.stringify(model)) {
        modelsMap.set(model.id, model);
      }
    }
    for (const removedId of existingModelIds) {
      modelsMap.delete(removedId);
    }

    // 2. Endpoints
    const endpointsMap = doc.getMap<Endpoint>('endpoints');
    const existingEpIds = new Set(endpointsMap.keys());
    for (const ep of project.endpoints) {
      existingEpIds.delete(ep.id);
      const current = endpointsMap.get(ep.id);
      if (JSON.stringify(current) !== JSON.stringify(ep)) {
        endpointsMap.set(ep.id, ep);
      }
    }
    for (const removedId of existingEpIds) {
      endpointsMap.delete(removedId);
    }

    // 3. Components
    const componentsMap = doc.getMap<ComponentDef>('components');
    const existingCompIds = new Set(componentsMap.keys());
    for (const comp of project.components) {
      existingCompIds.delete(comp.id);
      const current = componentsMap.get(comp.id);
      if (JSON.stringify(current) !== JSON.stringify(comp)) {
        componentsMap.set(comp.id, comp);
      }
    }
    for (const removedId of existingCompIds) {
      componentsMap.delete(removedId);
    }

    // 4. Assets
    const assetsMap = doc.getMap<Asset>('assets');
    const existingAssetIds = new Set(assetsMap.keys());
    for (const [id, asset] of Object.entries(project.assets)) {
      existingAssetIds.delete(id);
      const current = assetsMap.get(id);
      if (JSON.stringify(current) !== JSON.stringify(asset)) {
        assetsMap.set(id, asset);
      }
    }
    for (const removedId of existingAssetIds) {
      assetsMap.delete(removedId);
    }

    // 5. Boards, Nodes & Edges
    const boardsMap = doc.getMap<any>('boards');
    const boardNodesMap = doc.getMap<FlowNode>('boardNodes');
    const boardEdgesMap = doc.getMap<FlowEdge>('boardEdges');

    const existingBoardIds = new Set(boardsMap.keys());

    for (const board of project.boards) {
      existingBoardIds.delete(board.id);
      boardsMap.set(board.id, {
        id: board.id,
        name: board.name,
        kind: board.kind || 'flow',
        lanes: board.lanes,
        nodeOrder: board.nodes.map((n) => n.id),
        edgeOrder: board.edges.map((e) => e.id),
      });

      const prefix = board.id + ':';
      const existingNodeKeys = new Set(
        Array.from(boardNodesMap.keys()).filter((k) => k.startsWith(prefix))
      );
      for (const node of board.nodes) {
        const key = prefix + node.id;
        existingNodeKeys.delete(key);
        const current = boardNodesMap.get(key);
        if (JSON.stringify(current) !== JSON.stringify(node)) {
          boardNodesMap.set(key, clone(node));
        }
      }
      for (const removedKey of existingNodeKeys) {
        boardNodesMap.delete(removedKey);
      }

      const existingEdgeKeys = new Set(
        Array.from(boardEdgesMap.keys()).filter((k) => k.startsWith(prefix))
      );
      for (const edge of board.edges) {
        const key = prefix + edge.id;
        existingEdgeKeys.delete(key);
        const current = boardEdgesMap.get(key);
        if (JSON.stringify(current) !== JSON.stringify(edge)) {
          boardEdgesMap.set(key, clone(edge));
        }
      }
      for (const removedKey of existingEdgeKeys) {
        boardEdgesMap.delete(removedKey);
      }
    }

    for (const removedBoardId of existingBoardIds) {
      boardsMap.delete(removedBoardId);
      const prefix = removedBoardId + ':';
      Array.from(boardNodesMap.keys())
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => boardNodesMap.delete(k));
      Array.from(boardEdgesMap.keys())
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => boardEdgesMap.delete(k));
    }
  }, origin);
}

/**
 * Collaboration Manager handles room connections, Y.Doc lifecycle,
 * two-way synchronization with Zustand store, and awareness (live cursors).
 */
export class CollaborationManager {
  private doc: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private store: EditorStore | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private listeners = new Set<(status: CollaborationStatus) => void>();

  private roomName: string | null = null;
  private user: CollaborationUser;
  private isSynced = false;
  private isApplyingRemoteUpdate = false;

  constructor(initialUser?: Partial<CollaborationUser>) {
    this.doc = new Y.Doc();
    this.user = {
      id: initialUser?.id || 'usr_' + Math.random().toString(36).slice(2, 9),
      name: initialUser?.name || 'Gast',
      color: initialUser?.color || getRandomColor(),
    };

    // Listen to Yjs transactions for remote updates
    this.doc.on('afterTransaction', (tx) => {
      if (tx.origin !== 'local') {
        this.applyRemoteUpdateToStore();
      }
    });
  }

  public getDoc(): Y.Doc {
    return this.doc;
  }

  public getUser(): CollaborationUser {
    return { ...this.user };
  }

  public setUser(user: Partial<CollaborationUser>): void {
    this.user = { ...this.user, ...user };
    if (this.provider?.awareness) {
      this.provider.awareness.setLocalStateField('user', this.user);
    }
    this.notifyStatus();
  }

  public bindStore(store: EditorStore): () => void {
    this.store = store;

    this.storeUnsubscribe = store.subscribe((state) => {
      if (this.isApplyingRemoteUpdate) return;
      if (!this.roomName) return; // Only replicate when room is joined

      projectToDoc(this.doc, state.project, 'local');
    });

    return () => {
      this.storeUnsubscribe?.();
      this.storeUnsubscribe = null;
      this.store = null;
    };
  }

  public joinRoom(options: JoinRoomOptions): void {
    if (this.roomName) {
      this.leaveRoom();
    }

    this.roomName = options.roomName;
    if (options.user) {
      this.user = { ...options.user };
    }

    const signaling = options.signalingUrls && options.signalingUrls.length > 0
      ? options.signalingUrls
      : DEFAULT_SIGNALING_URLS;

    try {
      this.provider = new WebrtcProvider(this.roomName, this.doc, {
        signaling,
        password: options.password || undefined,
      });

      // Setup awareness
      this.provider.awareness.setLocalState({
        user: this.user,
        cursor: null,
        selection: [],
        activeBoardId: this.store?.getState().activeBoardId,
      });

      this.provider.awareness.on('change', () => {
        this.notifyStatus();
      });

      this.provider.on('synced', (event: { synced: boolean }) => {
        this.isSynced = event.synced;
        if (event.synced) {
          // If Y.Doc is empty after sync, push current store project
          const boardsMap = this.doc.getMap('boards');
          if (boardsMap.size === 0 && this.store) {
            projectToDoc(this.doc, this.store.getState().project, 'local');
          } else {
            this.applyRemoteUpdateToStore();
          }
        }
        this.notifyStatus();
      });

      this.provider.on('status', () => {
        this.notifyStatus();
      });

      this.provider.on('peers', () => {
        this.notifyStatus();
      });
    } catch (e) {
      console.warn('Could not initialize WebrtcProvider:', e);
    }

    // Immediately seed doc from store if store exists
    if (this.store) {
      const boardsMap = this.doc.getMap('boards');
      if (boardsMap.size === 0) {
        projectToDoc(this.doc, this.store.getState().project, 'local');
      }
    }

    this.notifyStatus();
  }

  public leaveRoom(): void {
    if (this.provider) {
      try {
        this.provider.destroy();
      } catch (e) {}
      this.provider = null;
    }
    this.roomName = null;
    this.isSynced = false;
    this.notifyStatus();
  }

  public updateCursor(cursor: { x: number; y: number } | null): void {
    if (!this.provider?.awareness) return;
    this.provider.awareness.setLocalStateField('cursor', cursor);
  }

  public updateSelection(selection: string[]): void {
    if (!this.provider?.awareness) return;
    this.provider.awareness.setLocalStateField('selection', selection);
  }

  public updateActiveBoard(boardId: string): void {
    if (!this.provider?.awareness) return;
    this.provider.awareness.setLocalStateField('activeBoardId', boardId);
  }

  public broadcastPing(x: number, y: number, boardId?: string): void {
    if (!this.provider?.awareness) return;
    this.provider.awareness.setLocalStateField('ping', {
      x,
      y,
      timestamp: Date.now(),
      boardId,
    });
    setTimeout(() => {
      if (this.provider?.awareness) {
        this.provider.awareness.setLocalStateField('ping', null);
      }
    }, 4000);
  }

  public getStatus(): CollaborationStatus {
    const peers: CollaborationPeerState[] = [];

    if (this.provider?.awareness) {
      const states = this.provider.awareness.getStates();
      states.forEach((state, clientId) => {
        if (clientId !== this.provider?.awareness.clientID && state.user) {
          peers.push({
            clientId,
            user: state.user as CollaborationUser,
            cursor: state.cursor || null,
            selection: state.selection || [],
            activeBoardId: state.activeBoardId,
            ping: state.ping || null,
          });
        }
      });
    }

    return {
      roomName: this.roomName,
      connected: !!this.provider?.connected,
      isSynced: this.isSynced,
      peers,
      self: { ...this.user },
    };
  }

  public subscribe(listener: (status: CollaborationStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }

  private applyRemoteUpdateToStore(): void {
    if (!this.store) return;
    try {
      this.isApplyingRemoteUpdate = true;
      const remoteProject = projectFromDoc(this.doc, this.store.getState().project);
      this.store.setProject(remoteProject, { resetHistory: false, preserveActiveBoard: true });
    } finally {
      this.isApplyingRemoteUpdate = false;
    }
  }

  public destroy(): void {
    this.leaveRoom();
    this.storeUnsubscribe?.();
    this.listeners.clear();
    this.doc.destroy();
  }
}
