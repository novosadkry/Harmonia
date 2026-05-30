import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { removeTrack } from '@/lib/playlist-service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  const { id, tid } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await removeTrack(s.userId, id, tid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
  }
}
