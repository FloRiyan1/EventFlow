import React, { createContext, useContext, useEffect, useState } from 'react';
import { useStore as useZustandStore } from 'zustand';
import {
  createEditorStore,
  createEmptyProject,
  createModel,
  createEndpoint,
  fieldsFromText,
  uid,
} from '@eventflow/core';
import type { EditorStore, EditorState, Project } from '@eventflow/core';

// Create a rich demo project matching the user's screenshot ("Positionen Erfassen")
function createInitialDemoProject(): Project {
  const project = createEmptyProject('Auftragserfassung');
  const board = project.boards[0];
  board.name = 'Positionen Erfassen';

  // 1. Models
  const taetigkeitModel = createModel('TaetigkeitPositionRESTModel', fieldsFromText(`
    String uuid
    String? nummer
    String? name
    String? kurztext
    String? langtext
    String? einheit
    double? preis
    double? menge
    int sortIndex
    bool abgeschlossen
    bool hasErfassungen
    double istMenge
    bool editable
  `));

  const pagedModel = createModel('PagedPositionenRESTModel', fieldsFromText(`
    List<TaetigkeitPositionRESTModel> positionen
    int currentPage
    int requestedEntriesPerPage
  `));

  const taetigkeitKriterienModel = createModel('TaetigkeitKriterienRESTModel', fieldsFromText(`
    String uuid
    int sortIndex
    String bezeichnung
    List<String> selektierbareWerte
  `));

  const taetigkeitInfoModel = createModel('TaetigkeitKriterienInfoRESTModel', fieldsFromText(`
    double progress
    List<TaetigkeitKriterienRESTModel> kriterien
  `));

  project.models = [taetigkeitModel, pagedModel, taetigkeitKriterienModel, taetigkeitInfoModel];

  // 2. Endpoints
  const ep1 = createEndpoint('POST', 'Taetigkeiten / Positionen');
  ep1.params = fieldsFromText(`
    +String taetigkeitUuid
    bool? unvollstaendig
    String? query
    String? scancode
    + int page
    + int entriesPerPage
  `);
  ep1.responseModelId = pagedModel.id;

  const ep2 = createEndpoint('POST', 'Taetigkeiten / taetigkeitInfo');
  ep2.params = fieldsFromText(`
    +String taetigkeitUuid
  `);
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
      sourceHandle: 'right', // UI -> API: rechts raus, links rein
      targetHandle: 'left',
      kind: 'flow',
      label: '',
    },
    {
      id: uid('e_'),
      source: ep1NodeId,
      target: pagedNodeId,
      sourceHandle: 'bottom', // API -> Model: immer nach unten
      targetHandle: 'top',
      kind: 'response',
      label: '',
    },
    {
      id: uid('e_'),
      source: pagedNodeId,
      target: taetigkeitNodeId,
      sourceHandle: 'bottom', // Model -> Model: nach unten
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
      sourceHandle: 'bottom', // API -> Model: immer nach unten
      targetHandle: 'top',
      kind: 'response',
      label: '',
    },
    {
      id: uid('e_'),
      source: taetigkeitInfoNodeId,
      target: taetigkeitKriterienNodeId,
      sourceHandle: 'bottom', // Model -> Model: nach unten
      targetHandle: 'top',
      kind: 'response',
      label: 'kriterien',
    }
  );

  return project;
}

const StoreContext = createContext<EditorStore | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store] = useState(() => {
    // Try restoring from localStorage safely
    try {
      const saved = localStorage.getItem('eventflow_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
          // Heal any missing arrays to avoid undefined crashes
          if (!Array.isArray(parsed.models)) parsed.models = [];
          if (!Array.isArray(parsed.endpoints)) parsed.endpoints = [];
          if (!parsed.assets || typeof parsed.assets !== 'object') parsed.assets = {};

          for (const m of parsed.models) {
            if (!Array.isArray(m.fields)) m.fields = [];
          }
          for (const ep of parsed.endpoints) {
            if (!Array.isArray(ep.params)) ep.params = [];
          }
          for (const b of parsed.boards) {
            if (!Array.isArray(b.nodes)) b.nodes = [];
            if (!Array.isArray(b.edges)) b.edges = [];
            if (!Array.isArray(b.lanes)) b.lanes = [];
            for (const n of b.nodes) {
              if (n.kind === 'screen') {
                if (!Array.isArray(n.hotspots)) n.hotspots = [];
                for (const h of n.hotspots) {
                  if (!Array.isArray(h.triggers)) h.triggers = [];
                }
              }
            }
          }
          return createEditorStore(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not restore autosave, starting fresh demo:', e);
      try {
        localStorage.removeItem('eventflow_autosave');
      } catch (err) {}
    }
    return createEditorStore(createInitialDemoProject());
  });

  // Autosave periodically
  useEffect(() => {
    const unsub = store.subscribe((state) => {
      try {
        localStorage.setItem('eventflow_autosave', JSON.stringify(state.project));
      } catch (e) {
        // LocalStorage may exceed quota for heavy images, which is okay
      }
    });
    return unsub;
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
};

export function useEditorStore(): EditorStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useEditorStore must be used within StoreProvider');
  return store;
}

export function useStore<T>(selector: (state: EditorState) => T): T {
  const store = useEditorStore();
  return useZustandStore(store, selector);
}
