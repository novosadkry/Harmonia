import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@harmonia/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tracks = await prisma.track.findMany({
      orderBy: { playCount: 'desc' },
      take: 50,
    });
    return NextResponse.json(tracks);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch trending tracks' }, { status: 500 });
  }
}
