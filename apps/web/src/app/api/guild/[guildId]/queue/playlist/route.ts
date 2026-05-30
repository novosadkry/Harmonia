import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enqueuePlaylist } from '@/lib/playback-service';
import { z } from 'zod';

const schema = z.object({ playlistId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    await enqueuePlaylist(s.userId, guildId, parsed.data.playlistId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to enqueue playlist';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
