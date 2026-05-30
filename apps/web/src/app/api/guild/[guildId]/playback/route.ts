import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlaybackState } from '@/lib/playback-service';

export async function GET(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const state = await getPlaybackState(params.guildId);
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get playback state' }, { status: 500 });
  }
}
