import { redis, keys, publishCommand } from '@harmonia/redis';
import { prisma } from '@harmonia/db';
import type { PlaybackState, TrackInQueue, BotCommand } from '@harmonia/types';

const DJ_LOCK_TTL = 300; // 5 minutes

export async function takeDJControl(
  userId: string,
  guildId: string,
  channelId: string,
): Promise<{ success: boolean; currentDj: string | null }> {
  const lockKey = keys.djLock(guildId);
  const result = await redis.set(lockKey, userId, 'EX', DJ_LOCK_TTL, 'NX');

  if (result !== 'OK') {
    const currentDj = await redis.get(lockKey);
    return { success: false, currentDj };
  }

  await publishCommand(redis, keys.commandChannel(guildId), {
    type: 'JOIN_CHANNEL',
    channelId,
  });

  return { success: true, currentDj: userId };
}

export async function releaseDJControl(
  userId: string,
  guildId: string,
): Promise<void> {
  const lockKey = keys.djLock(guildId);
  const currentDj = await redis.get(lockKey);

  if (currentDj !== userId) throw new Error('You do not hold DJ control');

  await publishCommand(redis, keys.commandChannel(guildId), { type: 'LEAVE_CHANNEL' });
  await redis.del(lockKey);
}

export async function getDJState(guildId: string): Promise<string | null> {
  return redis.get(keys.djLock(guildId));
}

export async function sendCommand(
  userId: string,
  guildId: string,
  command: BotCommand,
): Promise<void> {
  const currentDj = await redis.get(keys.djLock(guildId));
  if (currentDj !== userId) throw new Error('You do not hold DJ control');

  await redis.expire(keys.djLock(guildId), DJ_LOCK_TTL);
  await publishCommand(redis, keys.commandChannel(guildId), command);
}

export async function getPlaybackState(guildId: string): Promise<PlaybackState> {
  const raw = await redis.hgetall(keys.playbackState(guildId));

  return {
    status: (raw['status'] as PlaybackState['status']) ?? 'stopped',
    trackId: raw['trackId'] ?? null,
    startedAt: raw['startedAt'] ? parseInt(raw['startedAt'], 10) : null,
    pausedAt: raw['pausedAt'] ? parseInt(raw['pausedAt'], 10) : null,
    volume: raw['volume'] ? parseInt(raw['volume'], 10) : 80,
    loop: (raw['loop'] as PlaybackState['loop']) ?? 'none',
    shuffle: raw['shuffle'] === 'true',
  };
}

export async function getQueue(guildId: string): Promise<TrackInQueue[]> {
  const raw = await redis.lrange(keys.queue(guildId), 0, -1);
  return raw.map((item) => JSON.parse(item) as TrackInQueue);
}

export async function enqueueTrack(
  userId: string,
  guildId: string,
  trackId: string,
): Promise<void> {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track) throw new Error('Track not found');

  const entry: TrackInQueue = {
    trackId: track.id,
    youtubeVideoId: track.userOverrideYoutubeVideoId ?? track.youtubeVideoId,
    title: track.title,
    artist: track.artist,
    thumbnailUrl: track.thumbnailUrl,
    durationSeconds: track.durationSeconds,
    queuedBy: userId,
  };

  await redis.rpush(keys.queue(guildId), JSON.stringify(entry));
  await prisma.track.update({ where: { id: trackId }, data: { playCount: { increment: 1 } } });

  const queue = await getQueue(guildId);
  await publishCommand(redis, keys.commandChannel(guildId), {
    type: 'QUEUE_UPDATED' as never,
    queue,
  } as never);
}

export async function enqueuePlaylist(
  userId: string,
  guildId: string,
  playlistId: string,
): Promise<void> {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: { tracks: { include: { track: true }, orderBy: { position: 'asc' } } },
  });

  if (!playlist) throw new Error('Playlist not found');

  const entries: string[] = playlist.tracks.map((pt) => {
    const entry: TrackInQueue = {
      trackId: pt.track.id,
      youtubeVideoId: pt.track.userOverrideYoutubeVideoId ?? pt.track.youtubeVideoId,
      title: pt.track.title,
      artist: pt.track.artist,
      thumbnailUrl: pt.track.thumbnailUrl,
      durationSeconds: pt.track.durationSeconds,
      queuedBy: userId,
    };
    return JSON.stringify(entry);
  });

  if (entries.length > 0) {
    await redis.rpush(keys.queue(guildId), ...entries);
  }

  const queue = await getQueue(guildId);
  await publishCommand(redis, keys.commandChannel(guildId), {
    type: 'QUEUE_UPDATED' as never,
    queue,
  } as never);
}
