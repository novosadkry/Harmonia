import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { QueueManager } from './audio/queue-manager.js';
import { logger } from './logger.js';
import { env } from './env.js';

import * as djCommand from './commands/dj.js';
import * as skipCommand from './commands/skip.js';
import * as nowplayingCommand from './commands/nowplaying.js';

const commands = new Collection<string, {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}>();

commands.set(djCommand.data.name, djCommand);
commands.set(skipCommand.data.name, skipCommand);
commands.set(nowplayingCommand.data.name, nowplayingCommand);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const queueManagers = new Map<string, QueueManager>();

function getOrCreateQueueManager(guildId: string): QueueManager {
  const existing = queueManagers.get(guildId);
  if (existing) return existing;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error(`Guild ${guildId} not found in cache`);

  const manager = new QueueManager(guildId, guild);
  queueManagers.set(guildId, manager);
  return manager;
}

client.on(Events.ClientReady, (c) => {
  logger.info({ tag: c.user.tag }, 'Bot is ready');
  for (const guild of c.guilds.cache.values()) {
    try {
      getOrCreateQueueManager(guild.id);
    } catch (err) {
      logger.warn({ guildId: guild.id, err }, 'Failed to create QueueManager on startup');
    }
  }
});

client.on(Events.GuildCreate, (guild) => {
  logger.info({ guildId: guild.id, name: guild.name }, 'Joined new guild');
  try {
    getOrCreateQueueManager(guild.id);
  } catch (err) {
    logger.warn({ guildId: guild.id, err }, 'Failed to create QueueManager for new guild');
  }
});

client.on(Events.GuildDelete, (guild) => {
  const manager = queueManagers.get(guild.id);
  if (manager) {
    manager.destroy();
    queueManagers.delete(guild.id);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.guildId) {
      getOrCreateQueueManager(interaction.guildId);
    }
    await command.execute(interaction);
  } catch (err) {
    logger.error({ commandName: interaction.commandName, err }, 'Error executing command');
    const msg = { content: 'An error occurred executing that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(env.DISCORD_BOT_TOKEN);
