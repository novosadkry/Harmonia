import { redis, createSubscriber, keys, publishEvent } from '@harmonia/redis';
import type { BotCommand, BotEvent, TrackInQueue, PlaybackState } from '@harmonia/types';
import { GuildPlayer } from './player.js';
import { VoiceManager } from './voice-manager.js';
import type { Guild } from 'discord.js';
import { logger } from '../logger.js';

const DJ_LOCK_TTL = 300;

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
        const connection = await this.voiceManager.join(this.guild, command.channelId);
        this.player.setConnection(connection);
        await this.emitEvent({ type: 'BOT_JOINED', channelId: command.channelId });

        const firstTrack = await this.popNextTrack();
        if (firstTrack) await this.playTrack(firstTrack);
        break;
      }

      case 'LEAVE_CHANNEL': {
        this.player.stop();
        this.voiceManager.leave(this.guildId);
        await this.emitEvent({ type: 'BOT_LEFT' });
        break;
      }

      case 'PLAY': {
        this.player.resume();
        await this.updatePlaybackState({ status: 'playing' });
        break;
      }

      case 'PAUSE': {
        this.player.pause();
        await this.updatePlaybackState({ status: 'paused', pausedAt: Date.now() });
        break;
      }

      case 'SKIP': {
        this.player.stop();
        break;
      }

      case 'STOP': {
        this.player.stop();
        await redis.del(keys.queue(this.guildId));
        await this.updatePlaybackState({ status: 'stopped', trackId: null });
        break;
      }

      case 'SET_VOLUME': {
        this.player.setVolume(command.volume);
        await this.updatePlaybackState({ volume: command.volume });
        break;
      }

      case 'SET_LOOP': {
        await this.updatePlaybackState({ loop: command.mode });
        break;
      }

      case 'TOGGLE_SHUFFLE': {
        const state = await this.getState();
        await this.updatePlaybackState({ shuffle: !state.shuffle });
        break;
      }

      case 'SEEK': {
        logger.info({ guildId: this.guildId, positionSeconds: command.positionSeconds }, 'Seek requested (restart)');
        if (this.currentTrack) {
          await this.playTrack(this.currentTrack);
        }
        break;
      }
    }
  }

  private async onTrackEnded(): Promise<void> {
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
