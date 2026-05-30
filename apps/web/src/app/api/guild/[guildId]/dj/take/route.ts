import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { takeDJControl } from '@/lib/playback-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await takeDJControl(s.userId, guildId);
    if (!result.success) {
      return NextResponse.json({ error: 'DJ control taken by another user', currentDj: result.currentDj }, { status: 409 });
    }
    return NextResponse.json({ ok: true, userId: s.userId });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to take DJ control' }, { status: 500 });
  }
}
