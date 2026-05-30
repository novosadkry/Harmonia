import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { removeTrack } from '@/lib/playlist-service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; tid: string } },
) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await removeTrack(s.userId, params.id, params.tid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
  }
}
