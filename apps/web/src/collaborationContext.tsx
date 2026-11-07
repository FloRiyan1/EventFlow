import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  CollaborationManager,
  type CollaborationStatus,
  type CollaborationUser,
  getRandomColor,
} from '@eventflow/core';
import { useEditorStore } from './storeContext';

interface CollaborationContextValue {
  manager: CollaborationManager;
  status: CollaborationStatus;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  joinRoom: (
    roomName: string,
    user?: Partial<CollaborationUser>,
    options?: { password?: string; signalingUrls?: string[] }
  ) => void;
  leaveRoom: () => void;
  updateUser: (user: Partial<CollaborationUser>) => void;
  getShareUrl: (roomName?: string) => string;
  copyShareLink: () => Promise<boolean>;
  jumpToPeer: (clientId: number) => void;
  registerJumpHandler: (fn: (clientId: number) => void) => () => void;
}

const USER_STORAGE_KEY = 'eventflow_collab_user';

function getStoredUser(): CollaborationUser {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.name && parsed.color) return parsed;
    }
  } catch (e) {}

  const defaultUser: CollaborationUser = {
    id: 'usr_' + Math.random().toString(36).slice(2, 9),
    name: 'Teilnehmer ' + Math.floor(10 + Math.random() * 90),
    color: getRandomColor(),
  };
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(defaultUser));
  } catch (e) {}
  return defaultUser;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

export const CollaborationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useEditorStore();
  const [storedUser, setStoredUserState] = useState<CollaborationUser>(getStoredUser);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const manager = useMemo(() => new CollaborationManager(storedUser), []);

  const [status, setStatus] = useState<CollaborationStatus>(() => manager.getStatus());

  // Bind manager to store & subscribe to status changes
  useEffect(() => {
    const unbindStore = manager.bindStore(store);
    const unsubStatus = manager.subscribe(setStatus);

    return () => {
      unbindStore();
      unsubStatus();
      manager.destroy();
    };
  }, [manager, store]);

  // Sync activeBoardId to peers whenever active board changes in store
  useEffect(() => {
    const unsub = store.subscribe((state) => {
      manager.updateActiveBoard(state.activeBoardId);
    });
    return unsub;
  }, [manager, store]);

  const updateUser = useCallback(
    (userUpdate: Partial<CollaborationUser>) => {
      const updated = { ...storedUser, ...userUpdate };
      setStoredUserState(updated);
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      manager.setUser(updated);
    },
    [manager, storedUser]
  );

  const jumpHandlerRef = useRef<((clientId: number) => void) | null>(null);

  const registerJumpHandler = useCallback((fn: (clientId: number) => void) => {
    jumpHandlerRef.current = fn;
    return () => {
      if (jumpHandlerRef.current === fn) {
        jumpHandlerRef.current = null;
      }
    };
  }, []);

  const jumpToPeer = useCallback((clientId: number) => {
    jumpHandlerRef.current?.(clientId);
  }, []);

  const joinRoom = useCallback(
    (
      roomName: string,
      user?: Partial<CollaborationUser>,
      options?: { password?: string; signalingUrls?: string[] }
    ) => {
      const currentUser = user ? { ...storedUser, ...user } : storedUser;
      if (user) {
        updateUser(user);
      }
      manager.joinRoom({
        roomName,
        user: currentUser,
        password: options?.password,
        signalingUrls: options?.signalingUrls,
      });

      // Update URL hash without reload
      try {
        window.history.replaceState(null, '', `#room=${encodeURIComponent(roomName)}`);
      } catch (e) {}
    },
    [manager, storedUser, updateUser]
  );

  const leaveRoom = useCallback(() => {
    manager.leaveRoom();
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}
  }, [manager]);

  const getShareUrl = useCallback(
    (roomName?: string) => {
      const activeRoom = roomName || status.roomName || '';
      const base = window.location.origin + window.location.pathname;
      return activeRoom ? `${base}#room=${encodeURIComponent(activeRoom)}` : base;
    },
    [status.roomName]
  );

  const copyShareLink = useCallback(async () => {
    if (!status.roomName) return false;
    const url = getShareUrl(status.roomName);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (e) {
      return false;
    }
  }, [getShareUrl, status.roomName]);

  // Auto-join room from URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#room=')) {
      const room = decodeURIComponent(hash.slice(6));
      if (room && room !== status.roomName) {
        joinRoom(room);
      }
    }
  }, [joinRoom, status.roomName]);

  return (
    <CollaborationContext.Provider
      value={{
        manager,
        status,
        isModalOpen,
        setIsModalOpen,
        joinRoom,
        leaveRoom,
        updateUser,
        getShareUrl,
        copyShareLink,
        jumpToPeer,
        registerJumpHandler,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
};

export function useCollaboration(): CollaborationContextValue {
  const ctx = useContext(CollaborationContext);
  if (!ctx) throw new Error('useCollaboration must be used within CollaborationProvider');
  return ctx;
}
