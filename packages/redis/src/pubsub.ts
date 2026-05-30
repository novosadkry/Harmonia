import type { Redis } from 'ioredis';
import type { BotCommand, BotEvent } from '@harmonia/types';

export async function publishCommand(
  pub: Redis,
  channel: string,
  command: BotCommand,
): Promise<void> {
  await pub.publish(channel, JSON.stringify(command));
}

export async function publishEvent(
  pub: Redis,
  channel: string,
  event: BotEvent,
): Promise<void> {
  await pub.publish(channel, JSON.stringify(event));
}

export function subscribeToChannel(
  sub: Redis,
  channel: string,
  handler: (message: string) => void,
): void {
  sub.subscribe(channel).catch(console.error);
  sub.on('message', (ch: string, message: string) => {
    if (ch === channel) handler(message);
  });
}
