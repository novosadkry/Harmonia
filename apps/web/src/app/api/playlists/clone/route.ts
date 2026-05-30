import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { clonePlaylist } from '@/lib/playlist-service';
import { z } from 'zod';

const schema = z.object({ shareCode: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const playlist = await clonePlaylist(s.userId, parsed.data.shareCode);
    return NextResponse.json(playlist, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }
}
