import { create } from 'zustand';
import type { PlaybackState, TrackInQueue } from '@harmonia/types';

interface PlaybackStore {
  state: PlaybackState;
  queue: TrackInQueue[];
  djUserId: string | null;
  botError: string | null;
  setState: (state: PlaybackState) => void;
  setQueue: (queue: TrackInQueue[]) => void;
  setDjUserId: (userId: string | null) => void;
  setBotError: (error: string | null) => void;
}

const defaultState: PlaybackState = {
  status: 'stopped',
  trackId: null,
  currentTrack: null,
  startedAt: null,
  pausedAt: null,
  volume: 80,
  loop: 'none',
  shuffle: false,
};

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  state: defaultState,
  queue: [],
  djUserId: null,
  botError: null,
  setState: (state) => set({ state }),
  setQueue: (queue) => set({ queue }),
  setDjUserId: (userId) => set({ djUserId: userId }),
  setBotError: (error) => set({ botError: error }),
}));
