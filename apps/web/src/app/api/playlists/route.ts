import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createPlaylist, listUserPlaylists } from '@/lib/playlist-service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const playlists = await listUserPlaylists(s.userId);
    return NextResponse.json(playlists);
  } catch (e) {
    logger.error(e);
    return NextResponse.json({ error: 'Failed to list playlists' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten((i) => i.message) }, { status: 400 });
  }

  try {
    const playlist = await createPlaylist(s.userId, parsed.data.name, parsed.data.description);
    return NextResponse.json(playlist, { status: 201 });
  } catch (e) {
    logger.error(e);
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
  }
}
