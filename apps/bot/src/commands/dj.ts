import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { redis, keys } from '@harmonia/redis';
import { logger } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('dj')
  .setDescription('DJ control commands')
  .addSubcommand((sub) =>
    sub
      .setName('take')
      .setDescription('Take DJ control in your current voice channel'),
  )
  .addSubcommand((sub) =>
    sub.setName('release').setDescription('Release DJ control'),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'take') {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const channelId = member?.voice.channelId;

    if (!channelId) {
      await interaction.reply({ content: 'You must be in a voice channel.', ephemeral: true });
      return;
    }

    const lockKey = keys.djLock(guildId);
    const result = await redis.set(lockKey, interaction.user.id, 'EX', 300, 'NX');

    if (result !== 'OK') {
      const currentDj = await redis.get(lockKey);
      await interaction.reply({
        content: `DJ control is held by <@${currentDj}>.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: 'You now have DJ control!', ephemeral: false });
  } else if (sub === 'release') {
    const lockKey = keys.djLock(guildId);
    const currentDj = await redis.get(lockKey);

    if (currentDj !== interaction.user.id) {
      await interaction.reply({ content: 'You do not hold DJ control.', ephemeral: true });
      return;
    }

    await redis.del(lockKey);
    await interaction.reply({ content: 'DJ control released.', ephemeral: false });
  }
}
