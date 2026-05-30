import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getQueue, enqueueTrack, enqueuePlaylist } from '@/lib/playback-service';
import { z } from 'zod';

const enqueueTrackSchema = z.object({ trackId: z.string().min(1) });
const enqueuePlaylistSchema = z.object({ playlistId: z.string().min(1) });

export async function GET(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const queue = await getQueue(params.guildId);
    return NextResponse.json(queue);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const trackParsed = enqueueTrackSchema.safeParse(body);

  if (trackParsed.success) {
    try {
      await enqueueTrack(s.userId, params.guildId, trackParsed.data.trackId);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to enqueue';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
}
