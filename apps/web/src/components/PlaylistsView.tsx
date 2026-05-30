'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Music2, Lock, Globe } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  _count: { tracks: number };
}

export default function PlaylistsView({ guildId }: { guildId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ['playlists'],
    queryFn: () => fetch('/api/playlists').then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (playlistName: string) =>
      fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistName }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setCreating(false);
      setName('');
    },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">My Playlists</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Playlist
        </button>
      </div>

      {creating && (
        <div className="bg-surface rounded-xl p-6 mb-4">
          <input
            type="text"
            placeholder="Playlist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-2 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-accent mb-3"
            onKeyDown={(e) => e.key === 'Enter' && createMutation.mutate(name)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(name)}
              disabled={!name.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-white/50 hover:text-white px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="bg-surface rounded-xl p-12 text-center">
          <Music2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No playlists yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/dashboard/${guildId}/playlists/${playlist.id}`}
              className="bg-surface hover:bg-surface-2 rounded-xl p-6 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-3">
                <Music2 className="w-8 h-8 text-accent" />
                {playlist.isPublic ? (
                  <Globe className="w-4 h-4 text-white/30" />
                ) : (
                  <Lock className="w-4 h-4 text-white/30" />
                )}
              </div>
              <h3 className="font-semibold group-hover:text-accent-light transition-colors truncate">
                {playlist.name}
              </h3>
              <p className="text-sm text-white/40 mt-1">{playlist._count.tracks} tracks</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
