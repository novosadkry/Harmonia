'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import { TrendingUp, Download } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  playCount: number;
  durationSeconds: number;
}

export default function DiscoverView({ guildId }: { guildId: string }) {
  const [shareCode, setShareCode] = useState('');
  const queryClient = useQueryClient();

  const { data: trending = [] } = useQuery<Track[]>({
    queryKey: ['trending'],
    queryFn: () => apiFetch<Track[]>('/api/tracks/trending'),
  });

  const cloneMutation = useMutation({
    mutationFn: (code: string) =>
      apiFetch('/api/playlists/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareCode: code }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setShareCode('');
      alert('Playlist cloned to your library!');
    },
  });

  const enqueueTrackMutation = useMutation({
    mutationFn: (trackId: string) =>
      apiFetch(`/api/guild/${guildId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-display font-bold">Trending Tracks</h2>
        </div>
        <div className="space-y-2">
          {trending.slice(0, 20).map((track, index) => (
            <div
              key={track.id}
              className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-xl p-4 transition-colors cursor-pointer"
              onClick={() => enqueueTrackMutation.mutate(track.id)}
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
              <span className="text-sm text-white/30">{track.playCount} plays</span>
            </div>
          ))}
          {trending.length === 0 && (
            <div className="bg-surface rounded-xl p-8 text-center text-white/40">
              No trending tracks yet.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-display font-bold">Import Shared Playlist</h2>
        </div>
        <div className="bg-surface rounded-xl p-6">
          <p className="text-white/50 text-sm mb-4">
            Enter a share code to clone a playlist from another user.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter share code..."
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && shareCode.trim() && cloneMutation.mutate(shareCode.trim())
              }
              className="flex-1 bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => cloneMutation.mutate(shareCode.trim())}
              disabled={!shareCode.trim() || cloneMutation.isPending}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Clone
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
