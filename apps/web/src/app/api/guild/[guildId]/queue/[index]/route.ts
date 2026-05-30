import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { removeFromQueue } from '@/lib/playback-service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ guildId: string; index: string }> },
) {
  const { guildId, index } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
  }

  try {
    await removeFromQueue(s.userId, guildId, idx);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to remove';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
