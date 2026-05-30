import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deletePlaylist, getPlaylist } from '@/lib/playlist-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const playlist = await getPlaylist(s.userId, id);
    return NextResponse.json(playlist);
  } catch (e) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await deletePlaylist(s.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
  }
}
