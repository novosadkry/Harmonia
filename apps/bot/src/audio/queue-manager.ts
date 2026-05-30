import { redis, createSubscriber, keys, publishEvent } from '@harmonia/redis';
import type { BotCommand, BotEvent, TrackInQueue, PlaybackState } from '@harmonia/types';
import { GuildPlayer } from './player.js';
import { VoiceManager } from './voice-manager.js';
import type { Guild } from 'discord.js';
import { logger } from '../logger.js';

export class QueueManager {
  private player: GuildPlayer;
  private voiceManager: VoiceManager;
  private subscriber = createSubscriber();
  private currentTrack: TrackInQueue | null = null;

  constructor(
    public readonly guildId: string,
    private readonly guild: Guild,
  ) {
    this.player = new GuildPlayer(guildId);
    this.voiceManager = new VoiceManager();

    this.player.on('trackEnded', () => this.onTrackEnded());
    this.player.on('trackError', (error: string) => this.onTrackError(error));

    const channel = keys.commandChannel(guildId);
    this.subscriber.subscribe(channel).catch(console.error);
    this.subscriber.on('message', (_ch: string, msg: string) => {
      try {
        const command = JSON.parse(msg) as BotCommand;
        this.handleCommand(command).catch((err: unknown) => {
          logger.error({ guildId, err }, 'Error handling command');
        });
      } catch {
        // ignore malformed
      }
    });

    logger.info({ guildId }, 'QueueManager initialized');
  }

  private async handleCommand(command: BotCommand): Promise<void> {
    switch (command.type) {
      case 'JOIN_CHANNEL': {
        let member;
        try {
          member = await this.guild.members.fetch(command.userId);
        } catch {
          await redis.del(keys.djLock(this.guildId));
          await this.emitEvent({ type: 'DJ_CHANGED', userId: null });
          await this.emitEvent({ type: 'BOT_ERROR', error: 'Could not find you in this server.' });
          logger.debug({ guildId: this.guildId, userId: command.userId }, 'Failed to find user in server');
          break;
        }

        const channelId = member.voice.channelId;
        if (!channelId) {
          await redis.del(keys.djLock(this.guildId));
          await this.emitEvent({ type: 'DJ_CHANGED', userId: null });
          await this.emitEvent({ type: 'BOT_ERROR', error: 'You must be in a voice channel first.' });
          logger.debug({ guildId: this.guildId, userId: command.userId }, 'User not in voice channel');
          break;
        }

        let connection;
        try {
          connection = await this.voiceManager.join(this.guild, channelId);
        } catch (err) {
          await redis.del(keys.djLock(this.guildId));
          await this.emitEvent({ type: 'DJ_CHANGED', userId: null });
          await this.emitEvent({ type: 'BOT_ERROR', error: 'Failed to join voice channel.' });
          logger.error({ guildId: this.guildId, channelId, err }, 'Failed to join voice channel');
          break;
        }

        this.player.setConnection(connection);
        await this.emitEvent({ type: 'BOT_JOINED', channelId });
        logger.debug({ guildId: this.guildId, userId: command.userId }, 'Joined voice channel');

        const firstTrack = await this.popNextTrack();
        if (firstTrack) await this.playTrack(firstTrack);

        break;
      }

      case 'LEAVE_CHANNEL': {
        this.player.stop();
        this.voiceManager.leave(this.guildId);
        await this.emitEvent({ type: 'BOT_LEFT' });
        logger.debug({ guildId: this.guildId }, 'Left voice channel');
        break;
      }

      case 'PLAY': {
        const state = await this.getState();
        if (state.status === 'stopped') {
          const next = await this.popNextTrack();
          if (next) await this.playTrack(next);
        } else {
          this.player.resume();
          await this.updatePlaybackState({ status: 'playing' });
        }
        logger.debug({ guildId: this.guildId }, 'Playback resumed');
        break;
      }

      case 'PAUSE': {
        this.player.pause();
        await this.updatePlaybackState({ status: 'paused', pausedAt: Date.now() });
        logger.debug({ guildId: this.guildId }, 'Playback paused');
        break;
      }

      case 'SKIP': {
        this.player.stop();
        logger.debug({ guildId: this.guildId }, 'Track skipped');
        break;
      }

      case 'STOP': {
        this.player.stop();
        await redis.del(keys.queue(this.guildId));
        await this.updatePlaybackState({ status: 'stopped', trackId: null });
        logger.debug({ guildId: this.guildId }, 'Playback stopped and queue cleared');
        break;
      }

      case 'SET_VOLUME': {
        this.player.setVolume(command.volume);
        await this.updatePlaybackState({ volume: command.volume });
        logger.debug({ guildId: this.guildId, volume: command.volume }, 'Volume changed');
        break;
      }

      case 'SET_LOOP': {
        await this.updatePlaybackState({ loop: command.mode });
        logger.debug({ guildId: this.guildId, loopMode: command.mode }, 'Loop mode changed');
        break;
      }

      case 'TOGGLE_SHUFFLE': {
        const state = await this.getState();
        await this.updatePlaybackState({ shuffle: !state.shuffle });
        logger.debug({ guildId: this.guildId, shuffle: !state.shuffle }, 'Shuffle toggled');
        break;
      }

      case 'SEEK': {
        logger.debug({ guildId: this.guildId, positionSeconds: command.positionSeconds }, 'Seek requested (restart)');
        if (this.currentTrack) {
          await this.playTrack(this.currentTrack);
        }
        break;
      }
    }
  }

  private async onTrackEnded(): Promise<void> {
    logger.debug({ guildId: this.guildId }, 'Track ended');

    if (this.currentTrack) {
      await this.emitEvent({ type: 'TRACK_ENDED', trackId: this.currentTrack.trackId });
    }

    const state = await this.getState();

    if (state.loop === 'track' && this.currentTrack) {
      await this.playTrack(this.currentTrack);
      return;
    }

    if (state.loop === 'queue' && this.currentTrack) {
      await redis.rpush(keys.queue(this.guildId), JSON.stringify(this.currentTrack));
    }

    const next = await this.popNextTrack();
    if (next) {
      await this.playTrack(next);
    } else {
      this.currentTrack = null;
      await this.updatePlaybackState({ status: 'stopped', trackId: null });
    }
  }

  private async onTrackError(error: string): Promise<void> {
    logger.debug({ guildId: this.guildId, error }, 'Track error occurred');

    if (this.currentTrack) {
      await this.emitEvent({
        type: 'TRACK_ERROR',
        trackId: this.currentTrack.trackId,
        error,
      });
    }
    const next = await this.popNextTrack();
    if (next) await this.playTrack(next);
  }

  private async playTrack(track: TrackInQueue): Promise<void> {
    logger.debug({ guildId: this.guildId, trackId: track.trackId }, 'Attempting to play track');

    this.currentTrack = track;
    const videoId = track.youtubeVideoId;

    try {
      await this.player.play(videoId);
      await this.updatePlaybackState({
        status: 'playing',
        trackId: track.trackId,
        startedAt: Date.now(),
        pausedAt: null,
      });
      await this.emitEvent({ type: 'TRACK_STARTED', track });
      logger.debug({ guildId: this.guildId, trackId: track.trackId }, 'Track started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ guildId: this.guildId, videoId, err: msg }, 'Failed to play track');
      await this.emitEvent({ type: 'TRACK_ERROR', trackId: track.trackId, error: msg });
      const next = await this.popNextTrack();
      if (next) await this.playTrack(next);
    }
  }

  private async popNextTrack(): Promise<TrackInQueue | null> {
    const raw = await redis.lpop(keys.queue(this.guildId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TrackInQueue;
    } catch {
      return null;
    }
  }

  private async getState(): Promise<PlaybackState> {
    const raw = await redis.hgetall(keys.playbackState(this.guildId));
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

  private async updatePlaybackState(partial: Partial<PlaybackState>): Promise<void> {
    const current = await this.getState();
    const merged: PlaybackState = { ...current, ...partial };

    await redis.hmset(keys.playbackState(this.guildId), {
      status: merged.status,
      trackId: merged.trackId ?? '',
      startedAt: merged.startedAt?.toString() ?? '',
      pausedAt: merged.pausedAt?.toString() ?? '',
      volume: merged.volume.toString(),
      loop: merged.loop,
      shuffle: merged.shuffle.toString(),
    });

    await this.emitEvent({ type: 'PLAYBACK_STATE_CHANGED', state: merged });
  }

  private async emitEvent(event: BotEvent): Promise<void> {
    await publishEvent(redis, keys.eventChannel(this.guildId), event);
  }

  destroy(): void {
    this.subscriber.unsubscribe().catch(console.error);
    this.subscriber.quit().catch(console.error);
    this.player.stop();
    this.voiceManager.leave(this.guildId);
  }
}
