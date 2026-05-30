import NowPlayingView from '@/components/NowPlayingView';

export default async function NowPlayingPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <NowPlayingView guildId={guildId} />;
}
