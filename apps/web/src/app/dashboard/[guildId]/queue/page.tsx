'use client';

import QueueView from '@/components/QueueView';

export default function QueuePage({ params }: { params: { guildId: string } }) {
  return <QueueView guildId={params.guildId} />;
}
