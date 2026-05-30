'use client';

import PlaylistsView from '@/components/PlaylistsView';

export default function PlaylistsPage({ params }: { params: { guildId: string } }) {
  return <PlaylistsView guildId={params.guildId} />;
}
