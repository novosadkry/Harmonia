import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { releaseDJControl } from '@/lib/playback-service';

export async function POST(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await releaseDJControl(s.userId, params.guildId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to release DJ control';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
