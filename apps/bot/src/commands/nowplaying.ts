import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { redis, keys } from '@harmonia/redis';
import type { PlaybackState } from '@harmonia/types';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the currently playing track');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    return;
  }

  const raw = await redis.hgetall(keys.playbackState(guildId));
  const state: PlaybackState = {
    status: (raw['status'] as PlaybackState['status']) ?? 'stopped',
    trackId: raw['trackId'] ?? null,
    currentTrack: raw['currentTrack'] ? JSON.parse(raw['currentTrack']) : null,
    startedAt: raw['startedAt'] ? parseInt(raw['startedAt'], 10) : null,
    pausedAt: raw['pausedAt'] ? parseInt(raw['pausedAt'], 10) : null,
    volume: raw['volume'] ? parseInt(raw['volume'], 10) : 80,
    loop: (raw['loop'] as PlaybackState['loop']) ?? 'none',
    shuffle: raw['shuffle'] === 'true',
  };

  if (state.status === 'stopped' || !state.trackId) {
    await interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
    return;
  }

  const queue = await redis.lrange(keys.queue(guildId), 0, 0);
  const current = queue[0] ? JSON.parse(queue[0]) : null;

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(current?.title ?? 'Unknown Track')
    .setDescription(`by ${current?.artist ?? 'Unknown Artist'}`)
    .addFields(
      { name: 'Status', value: state.status, inline: true },
      { name: 'Volume', value: `${state.volume}%`, inline: true },
      { name: 'Loop', value: state.loop, inline: true },
    )
    .setFooter({ text: 'Playing via YouTube' });

  if (current?.thumbnailUrl) embed.setThumbnail(current.thumbnailUrl);

  await interaction.reply({ embeds: [embed] });
}
