export const keys = {
  playbackState: (guildId: string) => `guild:${guildId}:playback`,
  queue: (guildId: string) => `guild:${guildId}:queue`,
  djLock: (guildId: string) => `guild:${guildId}:dj`,
  commandChannel: (guildId: string) => `guild:${guildId}:commands`,
  eventChannel: (guildId: string) => `guild:${guildId}:events`,
  searchCache: (queryHash: string) => `search:${queryHash}`,
};
