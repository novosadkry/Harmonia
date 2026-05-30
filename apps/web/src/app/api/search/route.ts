import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type') ?? 'all';

  if (!q) return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });

  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) return NextResponse.json({ error: 'YouTube API not configured' }, { status: 500 });

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=10&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: 'Search failed' }, { status: 502 });

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { high?: { url?: string } };
        publishedAt?: string;
      };
    }>;
  };

  const results = (data.items ?? []).map((item) => ({
    videoId: item.id?.videoId,
    title: item.snippet?.title,
    artist: item.snippet?.channelTitle,
    thumbnailUrl: item.snippet?.thumbnails?.high?.url,
    publishedAt: item.snippet?.publishedAt,
  }));

  return NextResponse.json({ results });
}
