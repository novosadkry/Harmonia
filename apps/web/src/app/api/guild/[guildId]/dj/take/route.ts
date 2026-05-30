import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { takeDJControl } from '@/lib/playback-service';
import { z } from 'zod';

const schema = z.object({ channelId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await takeDJControl(s.userId, params.guildId, parsed.data.channelId);
    if (!result.success) {
      return NextResponse.json({ error: 'DJ control taken by another user', currentDj: result.currentDj }, { status: 409 });
    }
    return NextResponse.json({ ok: true, userId: s.userId });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to take DJ control' }, { status: 500 });
  }
}
