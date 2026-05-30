import {
  joinVoiceChannel,
  leaveVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import type { Guild, VoiceChannel } from 'discord.js';
import type { VoiceConnection } from '@discordjs/voice';
import { logger } from '../logger.js';

export class VoiceManager {
  private reconnectAttempts = 0;

  async join(guild: Guild, channelId: string): Promise<VoiceConnection> {
    const existing = getVoiceConnection(guild.id);
    if (existing) existing.destroy();

    const channel = await guild.channels.fetch(channelId) as VoiceChannel | null;
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      this.reconnectAttempts = 0;
    } catch {
      connection.destroy();
      throw new Error('Failed to join voice channel within 30 seconds');
    }

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.reconnectAttempts >= 1) {
        logger.warn({ guildId: guild.id }, 'Bot disconnected, giving up');
        connection.destroy();
        return;
      }

      this.reconnectAttempts++;
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        connection.destroy();
      }
    });

    return connection;
  }

  leave(guildId: string): void {
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
  }
}
