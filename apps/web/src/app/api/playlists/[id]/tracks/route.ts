import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { addTrack } from '@/lib/playlist-service';
import { z } from 'zod';

const addTrackSchema = z.object({ input: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = addTrackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const pt = await addTrack(s.userId, params.id, parsed.data.input);
    return NextResponse.json(pt, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to add track';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
