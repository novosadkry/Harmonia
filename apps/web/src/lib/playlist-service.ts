import { prisma } from '@harmonia/db';
import { nanoid } from 'nanoid';
import pLimit from 'p-limit';
import { resolveTrack } from './resolver.js';

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string,
) {
  return prisma.playlist.create({
    data: { userId, name, description },
    include: { tracks: { include: { track: true }, orderBy: { position: 'asc' } } },
  });
}

export async function deletePlaylist(userId: string, playlistId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist || playlist.userId !== userId) throw new Error('Not found or unauthorized');
  await prisma.playlist.delete({ where: { id: playlistId } });
}

export async function listUserPlaylists(userId: string) {
  return prisma.playlist.findMany({
    where: { userId },
    include: { _count: { select: { tracks: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getPlaylist(userId: string, playlistId: string) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: { tracks: { include: { track: true }, orderBy: { position: 'asc' } } },
  });
  if (!playlist || (playlist.userId !== userId && !playlist.isPublic)) {
    throw new Error('Not found or unauthorized');
  }
  return playlist;
}

export async function addTrack(userId: string, playlistId: string, input: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist || playlist.userId !== userId) throw new Error('Not found or unauthorized');

  const result = await resolveTrack(input, userId);
  if (!result.ok) throw new Error(result.error.message);

  const last = await prisma.playlistTrack.findFirst({
    where: { playlistId },
    orderBy: { position: 'desc' },
  });
  const position = (last?.position ?? -1) + 1;

  return prisma.playlistTrack.upsert({
    where: { playlistId_trackId: { playlistId, trackId: result.value.id } },
    create: { playlistId, trackId: result.value.id, position },
    update: {},
  });
}

export async function removeTrack(userId: string, playlistId: string, trackId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist || playlist.userId !== userId) throw new Error('Not found or unauthorized');
  await prisma.playlistTrack.delete({
    where: { playlistId_trackId: { playlistId, trackId } },
  });
}

export async function reorderTracks(
  userId: string,
  playlistId: string,
  orderedTrackIds: string[],
) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist || playlist.userId !== userId) throw new Error('Not found or unauthorized');

  await prisma.$transaction(
    orderedTrackIds.map((trackId, position) =>
      prisma.playlistTrack.update({
        where: { playlistId_trackId: { playlistId, trackId } },
        data: { position },
      }),
    ),
  );
}

export async function sharePlaylist(userId: string, playlistId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist || playlist.userId !== userId) throw new Error('Not found or unauthorized');

  const shareCode = playlist.shareCode ?? nanoid(8);
  const updated = await prisma.playlist.update({
    where: { id: playlistId },
    data: { shareCode, isPublic: true },
  });
  const baseUrl = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000';
  return { shareCode, url: `${baseUrl}/dashboard/discover?code=${shareCode}`, playlist: updated };
}

export async function clonePlaylist(userId: string, shareCode: string) {
  const source = await prisma.playlist.findUnique({
    where: { shareCode },
    include: { tracks: { orderBy: { position: 'asc' } } },
  });
  if (!source || !source.isPublic) throw new Error('Playlist not found or not public');

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, username: 'unknown', discriminator: '0000' },
  });

  const newPlaylist = await prisma.playlist.create({
    data: { userId, name: `${source.name} (copy)`, description: source.description },
  });

  await prisma.playlistTrack.createMany({
    data: source.tracks.map((pt) => ({
      playlistId: newPlaylist.id,
      trackId: pt.trackId,
      position: pt.position,
    })),
  });

  return newPlaylist;
}

export async function importFromSpotifyPlaylist(userId: string, spotifyPlaylistUrl: string) {
  const match = spotifyPlaylistUrl.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (!match?.[1]) throw new Error('Invalid Spotify playlist URL');
  const playlistId = match[1];

  const clientId = process.env['SPOTIFY_CLIENT_ID'];
  const clientSecret = process.env['SPOTIFY_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Spotify not configured');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('Failed to get Spotify token');

  const tracks: string[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error('Failed to fetch Spotify playlist');
    const data = (await res.json()) as {
      total?: number;
      items?: Array<{ track?: { uri?: string } }>;
    };
    total = data.total ?? 0;
    for (const item of data.items ?? []) {
      if (item.track?.uri) tracks.push(item.track.uri);
    }
    offset += 100;
  }

  const limit = pLimit(5);
  const playlist = await prisma.playlist.create({
    data: { userId, name: 'Imported from Spotify' },
  });

  const resolved = await Promise.allSettled(
    tracks.map((uri, index) =>
      limit(async () => {
        const trackUrl = uri.replace('spotify:track:', 'https://open.spotify.com/track/');
        const result = await resolveTrack(trackUrl, userId);
        return result.ok ? { trackId: result.value.id, position: index } : null;
      }),
    ),
  );

  const validTracks = resolved
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((t): t is { trackId: string; position: number } => t !== null);

  await prisma.playlistTrack.createMany({
    data: validTracks.map((t) => ({ playlistId: playlist.id, ...t })),
    skipDuplicates: true,
  });

  return playlist;
}

export async function importFromYouTubePlaylist(userId: string, youTubePlaylistUrl: string) {
  const match = youTubePlaylistUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (!match?.[1]) throw new Error('Invalid YouTube playlist URL');
  const listId = match[1];

  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) throw new Error('YouTube API not configured');

  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${listId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch YouTube playlist');
    const data = (await res.json()) as {
      nextPageToken?: string;
      items?: Array<{ contentDetails?: { videoId?: string } }>;
    };
    for (const item of data.items ?? []) {
      if (item.contentDetails?.videoId) videoIds.push(item.contentDetails.videoId);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  const limit = pLimit(5);
  const playlist = await prisma.playlist.create({
    data: { userId, name: 'Imported from YouTube' },
  });

  const resolved = await Promise.allSettled(
    videoIds.map((videoId, index) =>
      limit(async () => {
        const result = await resolveTrack(`https://youtube.com/watch?v=${videoId}`, userId);
        return result.ok ? { trackId: result.value.id, position: index } : null;
      }),
    ),
  );

  const validTracks = resolved
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((t): t is { trackId: string; position: number } => t !== null);

  await prisma.playlistTrack.createMany({
    data: validTracks.map((t) => ({ playlistId: playlist.id, ...t })),
    skipDuplicates: true,
  });

  return playlist;
}
