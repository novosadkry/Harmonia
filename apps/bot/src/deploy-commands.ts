import { REST, Routes } from 'discord.js';
import { data as djData } from './commands/dj.js';
import { data as skipData } from './commands/skip.js';
import { data as nowplayingData } from './commands/nowplaying.js';

const token = process.env['DISCORD_BOT_TOKEN'];
const clientId = process.env['DISCORD_CLIENT_ID'];

if (!token || !clientId) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

const commands = [djData.toJSON(), skipData.toJSON(), nowplayingData.toJSON()];
const rest = new REST().setToken(token);

(async () => {
  console.log('Registering slash commands...');
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log('Slash commands registered.');
})();
