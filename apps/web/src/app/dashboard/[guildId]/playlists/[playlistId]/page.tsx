import PlaylistDetailView from '@/components/PlaylistDetailView';

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ guildId: string; playlistId: string }>;
}) {
  const { guildId, playlistId } = await params;
  return <PlaylistDetailView guildId={guildId} playlistId={playlistId} />;
}
