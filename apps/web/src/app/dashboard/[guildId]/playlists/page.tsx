import PlaylistsView from '@/components/PlaylistsView';

export default async function PlaylistsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <PlaylistsView guildId={guildId} />;
}
