import { produce } from 'immer';
import { createStore } from 'zustand/vanilla';
import type { Project } from './schema';

const HISTORY_LIMIT = 200;

export interface UpdateOptions {
  /** Set to false for transient changes that should not create an undo step. */
  history?: boolean;
}

export interface SetProjectOptions {
  resetHistory?: boolean;
  preserveActiveBoard?: boolean;
}

export interface EditorState {
  project: Project;
  activeBoardId: string;
  past: Project[];
  future: Project[];
  /** Increments on every project change (used for autosave / dirty tracking). */
  revision: number;
  /** Revision that was last written to a file. */
  savedRevision: number;

  setProject(project: Project, options?: SetProjectOptions): void;
  update(recipe: (draft: Project) => void, options?: UpdateOptions): void;
  undo(): void;
  redo(): void;
  setActiveBoard(boardId: string): void;
  markSaved(): void;
}

const validBoard = (project: Project, boardId: string) =>
  project.boards.some((b) => b.id === boardId) ? boardId : project.boards[0].id;

/**
 * Central editor store. Every change goes through `update` (Immer recipe), which makes
 * undo/redo a matter of keeping immutable snapshots.
 */
export function createEditorStore(initial: Project) {
  const store = createStore<EditorState>()((set, get) => ({
    project: initial,
    activeBoardId: initial.boards[0].id,
    past: [],
    future: [],
    revision: 0,
    savedRevision: 0,

    setProject: (project, options) => {
      const revision = get().revision + 1;
      const preserveActiveBoard = options?.preserveActiveBoard ?? false;
      const resetHistory = options?.resetHistory ?? true;
      const activeBoardId = preserveActiveBoard
        ? validBoard(project, get().activeBoardId)
        : project.boards[0].id;

      set({
        project,
        activeBoardId,
        past: resetHistory ? [] : get().past,
        future: resetHistory ? [] : get().future,
        revision,
        savedRevision: revision,
      });
    },

    update: (recipe, options) => {
      const { project, past, future, revision, activeBoardId } = get();
      const next = produce(project, (draft) => {
        recipe(draft as Project);
      });
      if (next === project) return;
      const history = options?.history ?? true;
      set({
        project: next,
        past: history ? [...past, project].slice(-HISTORY_LIMIT) : past,
        future: history ? [] : future,
        revision: revision + 1,
        activeBoardId: validBoard(next, activeBoardId),
      });
    },

    undo: () => {
      const { past, project, future, revision, activeBoardId } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({
        project: previous,
        past: past.slice(0, -1),
        future: [project, ...future],
        revision: revision + 1,
        activeBoardId: validBoard(previous, activeBoardId),
      });
    },

    redo: () => {
      const { past, project, future, revision, activeBoardId } = get();
      const next = future[0];
      if (!next) return;
      set({
        project: next,
        past: [...past, project],
        future: future.slice(1),
        revision: revision + 1,
        activeBoardId: validBoard(next, activeBoardId),
      });
    },

    setActiveBoard: (boardId) => set({ activeBoardId: validBoard(get().project, boardId) }),

    markSaved: () => set({ savedRevision: get().revision }),
  }));

  return Object.assign(store, {
    update: (recipe: (draft: Project) => void, options?: UpdateOptions) => store.getState().update(recipe, options),
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    setProject: (p: Project, opts?: SetProjectOptions) => store.getState().setProject(p, opts),
    setActiveBoard: (id: string) => store.getState().setActiveBoard(id),
    markSaved: () => store.getState().markSaved(),
  });
}

export type EditorStore = ReturnType<typeof createEditorStore>;
