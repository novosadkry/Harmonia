import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@harmonia/db';
import type { Track } from '@harmonia/db';

type ResolverError =
  | { code: 'INVALID_INPUT'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'API_ERROR'; message: string };

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function youtubeVideoIdFromUrl(input: string): string | null {
  const watchMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1] ?? null;
  const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1] ?? null;
  return null;
}

function spotifyTrackId(input: string): string | null {
  const match = input.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  return match ? (match[1] ?? null) : null;
}

function isYouTubePlaylistUrl(input: string): boolean {
  return /youtube\.com\/playlist/.test(input) || /[?&]list=/.test(input);
}

function isSpotifyPlaylistUrl(input: string): boolean {
  return /open\.spotify\.com\/playlist\//.test(input);
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function hashQuery(q: string): string {
  return crypto.createHash('sha256').update(q).digest('hex');
}

async function fetchYouTubeVideoMetadata(videoId: string): Promise<{
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  thumbnailUrl?: string;
} | null> {
  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) return null;

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    items?: Array<{
      snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string } } };
      contentDetails?: { duration?: string };
    }>;
  };
  const item = data.items?.[0];
  if (!item) return null;

  const title = item.snippet?.title ?? 'Unknown Title';
  const artist = item.snippet?.channelTitle ?? 'Unknown Artist';
  const thumbnailUrl = item.snippet?.thumbnails?.high?.url;

  const isoDuration = item.contentDetails?.duration ?? 'PT0S';
  const durationMatch = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(durationMatch?.[1] ?? '0', 10);
  const minutes = parseInt(durationMatch?.[2] ?? '0', 10);
  const seconds = parseInt(durationMatch?.[3] ?? '0', 10);
  const durationSeconds = hours * 3600 + minutes * 60 + seconds;

  return { title, artist, durationSeconds, thumbnailUrl };
}

async function searchYouTube(query: string): Promise<string | null> {
  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) return null;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    items?: Array<{ id?: { videoId?: string } }>;
  };
  return data.items?.[0]?.id?.videoId ?? null;
}

async function resolveYouTubeVideoId(
  videoId: string,
  userId: string,
): Promise<Result<Track, ResolverError>> {
  const existing = await prisma.track.findUnique({ where: { youtubeVideoId: videoId } });
  if (existing) return { ok: true, value: existing };

  const meta = await fetchYouTubeVideoMetadata(videoId);
  if (!meta) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: `Could not fetch metadata for video ${videoId}` },
    };
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, username: 'unknown', discriminator: '0000' },
  });

  const track = await prisma.track.create({
    data: {
      youtubeVideoId: videoId,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      durationSeconds: meta.durationSeconds,
      thumbnailUrl: meta.thumbnailUrl,
      firstAddedBy: userId,
    },
  });

  return { ok: true, value: track };
}

export async function resolveTrack(
  input: string,
  userId: string,
): Promise<Result<Track, ResolverError>> {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'Empty input' } };
  }

  if (isYouTubePlaylistUrl(trimmed) || isSpotifyPlaylistUrl(trimmed)) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Use resolvePlaylist() for playlist URLs' },
    };
  }

  const ytVideoId = youtubeVideoIdFromUrl(trimmed);
  if (ytVideoId) {
    return resolveYouTubeVideoId(ytVideoId, userId);
  }

  const spotifyId = spotifyTrackId(trimmed);
  if (spotifyId) {
    const spotifyUri = `spotify:track:${spotifyId}`;
    const existing = await prisma.track.findUnique({ where: { spotifyUri } });
    if (existing) return { ok: true, value: existing };

    const clientId = process.env['SPOTIFY_CLIENT_ID'];
    const clientSecret = process.env['SPOTIFY_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: { code: 'API_ERROR', message: 'Spotify credentials not configured' },
      };
    }

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      return { ok: false, error: { code: 'API_ERROR', message: 'Failed to get Spotify token' } };
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return { ok: false, error: { code: 'API_ERROR', message: 'Invalid Spotify token response' } };
    }

    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!trackRes.ok) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Spotify track ${spotifyId} not found` },
      };
    }

    const trackData = (await trackRes.json()) as {
      name?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string; images?: Array<{ url?: string }> };
      duration_ms?: number;
      uri?: string;
    };

    const title = trackData.name ?? 'Unknown';
    const artist = trackData.artists?.[0]?.name ?? 'Unknown';
    const album = trackData.album?.name;
    const thumbnailUrl = trackData.album?.images?.[0]?.url;
    const durationSeconds = Math.floor((trackData.duration_ms ?? 0) / 1000);

    const ytQuery = `${artist} - ${title} official audio`;
    const ytVideoIdResult = await searchYouTube(ytQuery);

    if (!ytVideoIdResult) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Could not find YouTube video for "${ytQuery}"` },
      };
    }

    const ytExisting = await prisma.track.findUnique({
      where: { youtubeVideoId: ytVideoIdResult },
    });

    if (ytExisting) {
      const merged = await prisma.track.update({
        where: { id: ytExisting.id },
        data: { spotifyUri },
      });
      return { ok: true, value: merged };
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, username: 'unknown', discriminator: '0000' },
    });

    const track = await prisma.track.create({
      data: {
        youtubeVideoId: ytVideoIdResult,
        spotifyUri,
        title,
        artist,
        album,
        durationSeconds,
        thumbnailUrl,
        firstAddedBy: userId,
      },
    });

    return { ok: true, value: track };
  }

  const normalized = normalizeQuery(trimmed);
  const queryHash = hashQuery(normalized);

  const cached = await prisma.searchCache.findUnique({ where: { queryHash } });
  if (cached) {
    const track = await prisma.track.findUnique({ where: { id: cached.trackId } });
    if (track) {
      await prisma.searchCache.update({
        where: { queryHash },
        data: { hitCount: { increment: 1 }, lastSearchedAt: new Date() },
      });
      return { ok: true, value: track };
    }
  }

  const ytVideoId2 = await searchYouTube(trimmed);
  if (!ytVideoId2) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: `No YouTube results for "${trimmed}"` },
    };
  }

  const result = await resolveYouTubeVideoId(ytVideoId2, userId);
  if (!result.ok) return result;

  await prisma.searchCache.upsert({
    where: { queryHash },
    update: { hitCount: { increment: 1 }, lastSearchedAt: new Date(), trackId: result.value.id },
    create: { queryHash, queryRaw: trimmed, trackId: result.value.id },
  });

  return result;
}
