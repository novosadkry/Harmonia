import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { redis, keys, publishCommand } from '@harmonia/redis';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    return;
  }

  const currentDj = await redis.get(keys.djLock(guildId));
  if (currentDj !== interaction.user.id) {
    await interaction.reply({ content: 'You do not hold DJ control.', ephemeral: true });
    return;
  }

  await publishCommand(redis, keys.commandChannel(guildId), { type: 'SKIP' });
  await interaction.reply({ content: 'Skipping current track...', ephemeral: false });
}
