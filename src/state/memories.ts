import { create } from 'zustand';
import type { MemoryItem } from '@/types';
import {
  deleteMemory,
  listMemories,
  searchMemories,
  setPinned,
  updateMemoryContent,
} from '@/storage/memoriesRepo';

/** Store backing the memory browser (view / search / pin / edit / delete). */

interface MemoriesState {
  memories: MemoryItem[];
  query: string;
  load: () => Promise<void>;
  search: (q: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;
  edit: (id: string, content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useMemories = create<MemoriesState>((set, get) => ({
  memories: [],
  query: '',

  load: async () => {
    const all = await listMemories();
    // Pinned first, then most recent.
    all.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt);
    set({ memories: all, query: '' });
  },

  search: async (q) => {
    set({ query: q });
    if (!q.trim()) return get().load();
    set({ memories: await searchMemories(q.trim()) });
  },

  togglePin: async (id, pinned) => {
    await setPinned(id, pinned);
    set({ memories: get().memories.map((m) => (m.id === id ? { ...m, pinned } : m)) });
  },

  edit: async (id, content) => {
    await updateMemoryContent(id, content);
    set({ memories: get().memories.map((m) => (m.id === id ? { ...m, content } : m)) });
  },

  remove: async (id) => {
    await deleteMemory(id);
    set({ memories: get().memories.filter((m) => m.id !== id) });
  },
}));
