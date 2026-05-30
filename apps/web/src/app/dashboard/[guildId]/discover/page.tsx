import DiscoverView from '@/components/DiscoverView';

export default async function DiscoverPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <DiscoverView guildId={guildId} />;
}
