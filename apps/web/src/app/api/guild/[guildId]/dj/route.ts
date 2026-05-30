import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDJState } from '@/lib/playback-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = await getDJState(guildId);
  if (!userId) return NextResponse.json({ userId: null, displayName: null });

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${process.env['DISCORD_BOT_TOKEN']}` } },
    );
    if (res.ok) {
      const member = await res.json() as { nick?: string | null; user?: { global_name?: string | null; username?: string } };
      const displayName = member.nick ?? member.user?.global_name ?? member.user?.username ?? userId;
      return NextResponse.json({ userId, displayName });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({ userId, displayName: userId });
}
