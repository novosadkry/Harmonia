import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnection,
  NoSubscriberBehavior,
  StreamType,
} from '@discordjs/voice';
import type { AudioPlayer } from '@discordjs/voice';
import { EventEmitter } from 'events';
import ffmpegStatic from 'ffmpeg-static';
import { spawn } from 'child_process';
import { logger } from '../logger.js';

export class GuildPlayer extends EventEmitter {
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private volume = 0.8;

  constructor(public readonly guildId: string) {
    super();
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.emit('trackEnded');
    });

    this.player.on('error', (error) => {
      logger.error({ guildId, error: error.message }, 'AudioPlayer error');
      this.emit('trackError', error.message);
    });
  }

  setConnection(connection: VoiceConnection): void {
    this.connection = connection;
    connection.subscribe(this.player);
  }

  async play(youtubeVideoId: string): Promise<void> {
    const ytDlpPath = process.env['YTDLP_PATH'] ?? 'yt-dlp';
    const url = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    const ytdlp = spawn(ytDlpPath, [
      '--format', 'bestaudio[ext=webm]/bestaudio/best',
      '--get-url',
      '--no-playlist',
      url,
    ]);

    const streamUrl = await new Promise<string>((resolve, reject) => {
      let output = '';
      ytdlp.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      ytdlp.stderr.on('data', (chunk: Buffer) => {
        logger.debug({ guildId: this.guildId }, chunk.toString().trim());
      });
      ytdlp.on('close', (code) => {
        if (code !== 0) reject(new Error(`yt-dlp exited with code ${code}`));
        else resolve(output.trim());
      });
    });

    const ffmpegPath = (ffmpegStatic as unknown as string) ?? 'ffmpeg';
    const ffmpeg = spawn(ffmpegPath, [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', streamUrl,
      '-vn',
      '-af', `volume=${this.volume}`,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ]);

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    this.player.play(resource);
  }

  pause(): void {
    this.player.pause();
  }

  resume(): void {
    this.player.unpause();
  }

  stop(): void {
    this.player.stop(true);
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol / 100));
  }

  getStatus(): AudioPlayerStatus {
    return this.player.state.status;
  }
}
