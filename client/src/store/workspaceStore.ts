import { create } from "zustand";
import type { EntityType } from "shared";
import { api, ApiError } from "../api/client.js";

export interface MarkItem {
  id: string;
  fileId: string;
  startTokenId: string;
  endTokenId: string;
  text: string;
  entityType?: EntityType;
}

export interface PinnedEntity {
  id: string;
  fileId: string;
  text: string;
  type: EntityType;
}

export interface BoardNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label: string;
    entityType: EntityType;
  };
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  label: "SEEN AT" | "SCHEDULED ON" | "MENTIONED BY" | "CONNECTED TO";
}

export interface WorkspaceState {
  reviewed: string[];
  notes: string;
  marks: MarkItem[];
  pinnedEntities: PinnedEntity[];
  boardNodes: BoardNode[];
  boardEdges: BoardEdge[];
  boardHistory: { nodes: BoardNode[]; edges: BoardEdge[] }[];
  cipherScratchpad: string;
  extra: Record<string, unknown>;

  // Sync status
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: number | null;

  // Actions
  initFromSession: (workspaceData: Record<string, unknown>) => void;
  toggleReviewed: (fileId: string) => void;
  setNotes: (notes: string) => void;
  addMark: (mark: Omit<MarkItem, "id">) => MarkItem;
  removeMark: (markId: string) => void;
  addPinnedEntity: (entity: Omit<PinnedEntity, "id">) => PinnedEntity;
  removePinnedEntity: (id: string) => void;
  setBoard: (nodes: BoardNode[], edges: BoardEdge[], pushHistory?: boolean) => void;
  undoBoard: () => void;
  clearBoard: () => void;
  setCipherScratchpad: (scratchpad: string) => void;
  dismissSaveError: () => void;
  forceSave: () => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY_MS = 1000;
const MAX_BYTES = 128 * 1024;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const triggerDebouncedSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      void get().forceSave();
    }, DEBOUNCE_DELAY_MS);
  };

  return {
    reviewed: [],
    notes: "",
    marks: [],
    pinnedEntities: [],
    boardNodes: [],
    boardEdges: [],
    boardHistory: [],
    cipherScratchpad: "",
    extra: {},
    isSaving: false,
    saveError: null,
    lastSavedAt: null,

    initFromSession: (workspaceData: Record<string, unknown>) => {
      if (!workspaceData || typeof workspaceData !== "object") return;

      const reviewed = Array.isArray(workspaceData["reviewed"])
        ? (workspaceData["reviewed"] as string[])
        : get().reviewed;

      const notes =
        typeof workspaceData["notes"] === "string"
          ? (workspaceData["notes"] as string)
          : get().notes;

      const marks = Array.isArray(workspaceData["marks"])
        ? (workspaceData["marks"] as MarkItem[])
        : get().marks;

      const pinnedEntities = Array.isArray(workspaceData["pinnedEntities"])
        ? (workspaceData["pinnedEntities"] as PinnedEntity[])
        : get().pinnedEntities;

      const boardNodes = Array.isArray(workspaceData["boardNodes"])
        ? (workspaceData["boardNodes"] as BoardNode[])
        : get().boardNodes;

      const boardEdges = Array.isArray(workspaceData["boardEdges"])
        ? (workspaceData["boardEdges"] as BoardEdge[])
        : get().boardEdges;

      const cipherScratchpad =
        typeof workspaceData["cipherScratchpad"] === "string"
          ? (workspaceData["cipherScratchpad"] as string)
          : get().cipherScratchpad;

      const extra = { ...workspaceData };
      delete extra["reviewed"];
      delete extra["notes"];
      delete extra["marks"];
      delete extra["pinnedEntities"];
      delete extra["boardNodes"];
      delete extra["boardEdges"];
      delete extra["cipherScratchpad"];

      set({
        reviewed,
        notes,
        marks,
        pinnedEntities,
        boardNodes,
        boardEdges,
        boardHistory: [],
        cipherScratchpad,
        extra,
        saveError: null,
      });
    },

    toggleReviewed: (fileId: string) => {
      const current = get().reviewed;
      const next = current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId];
      set({ reviewed: next });
      triggerDebouncedSave();
    },

    setNotes: (notes: string) => {
      set({ notes });
      triggerDebouncedSave();
    },

    addMark: (markData) => {
      const id = `mark-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newMark: MarkItem = { ...markData, id };
      set((state) => ({ marks: [...state.marks, newMark] }));
      triggerDebouncedSave();
      return newMark;
    },

    removeMark: (markId: string) => {
      set((state) => ({ marks: state.marks.filter((m) => m.id !== markId) }));
      triggerDebouncedSave();
    },

    addPinnedEntity: (entityData) => {
      const id = `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPin: PinnedEntity = { ...entityData, id };
      set((state) => ({ pinnedEntities: [...state.pinnedEntities, newPin] }));
      triggerDebouncedSave();
      return newPin;
    },

    removePinnedEntity: (id: string) => {
      set((state) => ({
        pinnedEntities: state.pinnedEntities.filter((e) => e.id !== id),
      }));
      triggerDebouncedSave();
    },

    setBoard: (nodes: BoardNode[], edges: BoardEdge[], pushHistory = true) => {
      set((state) => {
        const nextHistory = pushHistory
          ? [...state.boardHistory.slice(-20), { nodes: state.boardNodes, edges: state.boardEdges }]
          : state.boardHistory;
        return {
          boardNodes: nodes,
          boardEdges: edges,
          boardHistory: nextHistory,
        };
      });
      triggerDebouncedSave();
    },

    undoBoard: () => {
      const state = get();
      if (state.boardHistory.length === 0) return;
      const last = state.boardHistory[state.boardHistory.length - 1];
      if (!last) return;
      const remainingHistory = state.boardHistory.slice(0, -1);
      set({
        boardNodes: last.nodes,
        boardEdges: last.edges,
        boardHistory: remainingHistory,
      });
      triggerDebouncedSave();
    },

    clearBoard: () => {
      const state = get();
      set({
        boardHistory: [...state.boardHistory.slice(-20), { nodes: state.boardNodes, edges: state.boardEdges }],
        boardNodes: [],
        boardEdges: [],
      });
      triggerDebouncedSave();
    },

    setCipherScratchpad: (scratchpad: string) => {
      set({ cipherScratchpad: scratchpad });
      triggerDebouncedSave();
    },

    dismissSaveError: () => {
      set({ saveError: null });
    },

    forceSave: async () => {
      const state = get();
      const payload: Record<string, unknown> = {
        reviewed: state.reviewed,
        notes: state.notes,
        marks: state.marks,
        pinnedEntities: state.pinnedEntities,
        boardNodes: state.boardNodes,
        boardEdges: state.boardEdges,
        cipherScratchpad: state.cipherScratchpad,
        ...state.extra,
      };

      // Client pre-check for size
      try {
        const json = JSON.stringify(payload);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(json).length;
        if (bytes > MAX_BYTES) {
          set({
            saveError:
              "WORKSPACE CAPACITY EXCEEDED (128 KB MAX). CHANGES NOT SAVED TO SERVER.",
          });
          return;
        }
      } catch {
        // serialization issue
      }

      set({ isSaving: true });
      try {
        await api.putWorkspace(payload);
        set({ isSaving: false, lastSavedAt: Date.now(), saveError: null });
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 413) {
          set({
            isSaving: false,
            saveError:
              "WORKSPACE CAPACITY EXCEEDED (128 KB MAX). CHANGES NOT SAVED TO SERVER.",
          });
        } else {
          set({
            isSaving: false,
            saveError: "FAILED TO SYNC WORKSPACE. WILL RETRY ON NEXT CHANGE.",
          });
        }
      }
    },
  };
});
