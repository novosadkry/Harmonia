import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sharePlaylist } from '@/lib/playlist-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await sharePlaylist(s.userId, id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to share playlist' }, { status: 400 });
  }
}
