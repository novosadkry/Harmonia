import QueueView from '@/components/QueueView';

export default async function QueuePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <QueueView guildId={guildId} />;
}
