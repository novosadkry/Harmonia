'use client';

import { usePlaybackStore } from '@/store/playback';
import Image from 'next/image';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QueueView({ guildId }: { guildId: string }) {
  const { queue } = usePlaybackStore();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Queue</h1>
        <span className="text-sm text-white/40">{queue.length} tracks</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
