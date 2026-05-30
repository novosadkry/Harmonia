import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { importFromSpotifyPlaylist, importFromYouTubePlaylist } from '@/lib/playlist-service';
import { z } from 'zod';

const schema = z.object({ url: z.string().url() });

export async function POST(req: NextRequest) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const url = parsed.data.url;
    let playlist;
    if (url.includes('spotify.com/playlist')) {
      playlist = await importFromSpotifyPlaylist(s.userId, url);
    } else if (url.includes('youtube.com/playlist') || url.includes('list=')) {
      playlist = await importFromYouTubePlaylist(s.userId, url);
    } else {
      return NextResponse.json({ error: 'Unsupported playlist URL' }, { status: 400 });
    }
    return NextResponse.json(playlist, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
