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

export interface WorkspaceState {
  reviewed: string[];
  notes: string;
  marks: MarkItem[];
  pinnedEntities: PinnedEntity[];
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

      const extra = { ...workspaceData };
      delete extra["reviewed"];
      delete extra["notes"];
      delete extra["marks"];
      delete extra["pinnedEntities"];

      set({
        reviewed,
        notes,
        marks,
        pinnedEntities,
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
