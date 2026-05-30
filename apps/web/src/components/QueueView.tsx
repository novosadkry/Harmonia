'use client';

import { usePlaybackStore } from '@/store/playback';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { TrackInQueue } from '@harmonia/types';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QueueView({ guildId }: { guildId: string }) {
  const { queue } = usePlaybackStore();
  const [input, setInput] = useState('');

  const enqueueMutation = useMutation({
    mutationFn: (value: string) =>
      apiFetch(`/api/guild/${guildId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value }),
      }),
    onSuccess: () => setInput(''),
  });

  const removeMutation = useMutation({
    mutationFn: (index: number) =>
      apiFetch(`/api/guild/${guildId}/queue/${index}`, { method: 'DELETE' }),
  });

  const reorderMutation = useMutation({
    mutationFn: (newQueue: TrackInQueue[]) =>
      apiFetch(`/api/guild/${guildId}/queue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue: newQueue }),
      }),
  });

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= queue.length || reorderMutation.isPending) return;
    const newQueue = [...queue];
    const [item] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, item!);
    reorderMutation.mutate(newQueue);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold">Queue</h1>
        <span className="text-sm text-white/40">{queue.length} tracks</span>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="YouTube URL, Spotify URL, or search query..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && input.trim() && enqueueMutation.mutate(input.trim())
          }
          className="flex-1 bg-surface border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-accent"
        />
        <button
          onClick={() => enqueueMutation.mutate(input.trim())}
          disabled={!input.trim() || enqueueMutation.isPending}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="bg-surface rounded-xl p-12 text-center">
          <p className="text-white/40">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((track, index) => (
            <div
              key={`${track.trackId}-${index}`}
              className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-xl p-4 transition-colors group"
            >
              <span className="text-sm text-white/30 w-6 text-right shrink-0">{index + 1}</span>
              {track.thumbnailUrl ? (
                <Image
                  src={track.thumbnailUrl}
                  alt={track.title}
                  width={48}
                  height={48}
                  className="rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-2 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{track.title}</p>
                <p className="text-sm text-white/50 truncate">{track.artist}</p>
              </div>
              <span className="text-sm text-white/40 shrink-0">
                {formatDuration(track.durationSeconds)}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0 || reorderMutation.isPending}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(index, index + 1)}
                  disabled={index === queue.length - 1 || reorderMutation.isPending}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeMutation.mutate(index)}
                  disabled={removeMutation.isPending}
                  className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
