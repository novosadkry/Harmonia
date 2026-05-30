'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import { Trash2, Plus, Share2, Play } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
}

interface PlaylistTrack {
  trackId: string;
  position: number;
  track: Track;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  tracks: PlaylistTrack[];
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistDetailView({
  guildId,
  playlistId,
}: {
  guildId: string;
  playlistId: string;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');

  const { data: playlist } = useQuery<Playlist>({
    queryKey: ['playlist', playlistId],
    queryFn: () => apiFetch<Playlist>(`/api/playlists/${playlistId}`),
  });

  const addTrackMutation = useMutation({
    mutationFn: (trackInput: string) =>
      apiFetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trackInput }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      setInput('');
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: (trackId: string) =>
      apiFetch(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    },
  });

  const enqueueAllMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/guild/${guildId}/queue/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId }),
      }),
  });

  const shareMutation = useMutation({
    mutationFn: () => apiFetch<{ url: string }>(`/api/playlists/${playlistId}/share`, { method: 'POST' }),
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.url).catch(() => {});
      alert(`Share link copied: ${data.url}`);
    },
  });

  if (!playlist) return <div className="text-white/40 p-8">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">{playlist.name}</h1>
          {playlist.description && <p className="text-white/50 mt-1">{playlist.description}</p>}
          <p className="text-sm text-white/30 mt-1">{playlist.tracks.length} tracks</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => enqueueAllMutation.mutate()}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Play className="w-4 h-4" /> Play All
          </button>
          <button
            onClick={() => shareMutation.mutate()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="YouTube URL, Spotify URL, or search query..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && input.trim() && addTrackMutation.mutate(input.trim())
          }
          className="flex-1 bg-surface border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-accent"
        />
        <button
          onClick={() => addTrackMutation.mutate(input.trim())}
          disabled={!input.trim() || addTrackMutation.isPending}
          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2">
        {playlist.tracks.map((pt, index) => (
          <div
            key={pt.trackId}
            className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-xl p-4 transition-colors group"
          >
            <span className="text-sm text-white/30 w-6 text-right shrink-0">{index + 1}</span>
            {pt.track.thumbnailUrl ? (
              <Image
                src={pt.track.thumbnailUrl}
                alt={pt.track.title}
                width={48}
                height={48}
                className="rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-surface-2 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{pt.track.title}</p>
              <p className="text-sm text-white/50 truncate">{pt.track.artist}</p>
            </div>
            <span className="text-sm text-white/40 shrink-0">
              {formatDuration(pt.track.durationSeconds)}
            </span>
            <button
              onClick={() => removeTrackMutation.mutate(pt.trackId)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
