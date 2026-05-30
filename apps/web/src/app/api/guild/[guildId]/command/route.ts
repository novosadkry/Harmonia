import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendCommand } from '@/lib/playback-service';
import { z } from 'zod';
import type { BotCommand } from '@harmonia/types';

const commandSchema = z.object({
  command: z.discriminatedUnion('type', [
    z.object({ type: z.literal('PLAY') }),
    z.object({ type: z.literal('PAUSE') }),
    z.object({ type: z.literal('SKIP') }),
    z.object({ type: z.literal('STOP') }),
    z.object({ type: z.literal('SEEK'), positionSeconds: z.number() }),
    z.object({ type: z.literal('SET_VOLUME'), volume: z.number().min(0).max(100) }),
    z.object({ type: z.literal('SET_LOOP'), mode: z.enum(['none', 'track', 'queue']) }),
    z.object({ type: z.literal('TOGGLE_SHUFFLE') }),
    z.object({ type: z.literal('JOIN_CHANNEL'), channelId: z.string() }),
    z.object({ type: z.literal('LEAVE_CHANNEL') }),
  ]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    await sendCommand(s.userId, guildId, parsed.data.command as BotCommand);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to send command';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
