import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { reorderTracks } from '@/lib/playlist-service';
import { z } from 'zod';

const schema = z.object({ orderedTrackIds: z.array(z.string()).min(1) });

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    await reorderTracks(s.userId, params.id, parsed.data.orderedTrackIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 400 });
  }
}
