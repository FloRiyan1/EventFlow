import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useStore as useZustandStore } from 'zustand';
import {
  createEditorStore,
  createInitialDemoProject,
} from '@eventflow/core';
import type { EditorStore, EditorState, Project } from '@eventflow/core';
import { realtimeSync, type SyncConnectionStatus } from './realtimeSync';

const StoreContext = createContext<EditorStore | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store] = useState(() => {
    // Try restoring from localStorage safely as instant cache
    try {
      const saved = localStorage.getItem('eventflow_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
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
          }
          return createEditorStore(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not restore local cache, starting fresh demo:', e);
      try {
        localStorage.removeItem('eventflow_autosave');
      } catch {}
    }
    return createEditorStore(createInitialDemoProject());
  });

  const isRemoteSyncRef = useRef(false);
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 1. Connect to live server
    realtimeSync.connect();

    // 2. Fetch server project immediately if available (initial sync)
    realtimeSync.fetchServerProject().then((serverProject) => {
      if (serverProject && Array.isArray(serverProject.boards) && serverProject.boards.length > 0) {
        isRemoteSyncRef.current = true;
        store.setProject(serverProject, { preserveActiveBoard: true, resetHistory: false });
        isRemoteSyncRef.current = false;
        try {
          localStorage.setItem('eventflow_autosave', JSON.stringify(serverProject));
        } catch {}
      }
    });

    // 3. Listen for incoming live sync events from other users
    const unsubSync = realtimeSync.onSync((remoteProject) => {
      if (remoteProject && Array.isArray(remoteProject.boards) && remoteProject.boards.length > 0) {
        isRemoteSyncRef.current = true;
        store.setProject(remoteProject, { preserveActiveBoard: true, resetHistory: false });
        isRemoteSyncRef.current = false;
        try {
          localStorage.setItem('eventflow_autosave', JSON.stringify(remoteProject));
        } catch {}
      }
    });

    // 4. Subscribe to local store changes to broadcast to server & other users
    const unsubStore = store.subscribe((state) => {
      try {
        localStorage.setItem('eventflow_autosave', JSON.stringify(state.project));
      } catch {}

      // If change was triggered by remote sync, do not echo back
      if (isRemoteSyncRef.current) return;

      // Debounce slightly (60ms) to batch rapid mouse movements or typing
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = setTimeout(() => {
        realtimeSync.broadcastProject(state.project);
      }, 60);
    });

    return () => {
      unsubSync();
      unsubStore();
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
    };
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

/**
 * Hook to observe the live real-time server connection status and online user count
 */
export function useSyncStatus(): { status: SyncConnectionStatus; userCount: number } {
  const [status, setStatus] = useState(() => realtimeSync.getStatus());

  useEffect(() => {
    return realtimeSync.onStatusChange((newStatus, userCount) => {
      setStatus({ status: newStatus, userCount });
    });
  }, []);

  return status;
}
