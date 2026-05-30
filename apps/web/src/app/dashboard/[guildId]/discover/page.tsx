'use client';

import DiscoverView from '@/components/DiscoverView';

export default function DiscoverPage({ params }: { params: { guildId: string } }) {
  return <DiscoverView guildId={params.guildId} />;
}
