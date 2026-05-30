import { create } from 'zustand';

interface GuildStore {
  currentGuildId: string | null;
  setCurrentGuildId: (id: string) => void;
}

export const useGuildStore = create<GuildStore>((set) => ({
  currentGuildId: null,
  setCurrentGuildId: (id) => set({ currentGuildId: id }),
}));
