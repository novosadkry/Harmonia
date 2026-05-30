'use client';

import PlaylistDetailView from '@/components/PlaylistDetailView';

export default function PlaylistDetailPage({
  params,
}: {
  params: { guildId: string; playlistId: string };
}) {
  return <PlaylistDetailView guildId={params.guildId} playlistId={params.playlistId} />;
}
