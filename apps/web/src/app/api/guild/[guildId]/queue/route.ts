import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getQueue, enqueueTrack, enqueueByInput, reorderQueue } from '@/lib/playback-service';
import type { TrackInQueue } from '@harmonia/types';
import { z } from 'zod';

const enqueueTrackSchema = z.object({ trackId: z.string().min(1) });
const enqueueInputSchema = z.object({ input: z.string().min(1) });
const reorderSchema = z.object({ queue: z.array(z.unknown()) });

export async function GET(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const queue = await getQueue(guildId);
    return NextResponse.json(queue);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const trackParsed = enqueueTrackSchema.safeParse(body);

  if (trackParsed.success) {
    try {
      await enqueueTrack(s.userId, guildId, trackParsed.data.trackId);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to enqueue';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const inputParsed = enqueueInputSchema.safeParse(body);
  if (inputParsed.success) {
    try {
      await enqueueByInput(s.userId, guildId, inputParsed.data.input);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to enqueue';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  try {
    await reorderQueue(s.userId, guildId, parsed.data.queue as TrackInQueue[]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to reorder';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
