'use client';

import { usePlaybackStore } from '@/store/playback';
import NowPlayingView from '@/components/NowPlayingView';

export default function NowPlayingPage({ params }: { params: { guildId: string } }) {
  return <NowPlayingView guildId={params.guildId} />;
}
