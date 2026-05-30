import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Music2 } from 'lucide-react';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count?: number;
}

async function getUserGuilds(accessToken: string): Promise<Guild[]> {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json() as Promise<Guild[]>;
}

async function getBotGuildIds(): Promise<Set<string>> {
  const botToken = process.env['DISCORD_BOT_TOKEN'];
  if (!botToken) return new Set();
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bot ${botToken}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return new Set();
  const guilds = (await res.json()) as Guild[];
  return new Set(guilds.map((g) => g.id));
}

export default async function DashboardPage() {
  const session = await auth();
  const s = session as typeof session & { userId?: string; accessToken?: string };
  if (!s?.userId) redirect('/');

  const [userGuilds, botGuildIds] = await Promise.all([
    s.accessToken ? getUserGuilds(s.accessToken) : Promise.resolve([]),
    getBotGuildIds(),
  ]);

  const guilds = userGuilds.filter((g) => botGuildIds.has(g.id));

  return (
    <main className="min-h-screen p-8 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Music2 className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-display font-bold">Your Servers</h1>
        </div>

        {guilds.length === 0 ? (
          <div className="bg-surface rounded-xl p-12 text-center">
            <p className="text-white/50 mb-4">No servers found. Make sure you have the Harmonia bot in a server.</p>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env['DISCORD_CLIENT_ID']}&permissions=3148800&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg font-semibold"
            >
              Add Harmonia to a Server
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {guilds.map((guild) => (
              <a
                key={guild.id}
                href={`/dashboard/${guild.id}`}
                className="bg-surface hover:bg-surface-2 rounded-xl p-6 flex items-center gap-4 group transition-all"
              >
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                    alt={guild.name}
                    className="w-14 h-14 rounded-full"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
                    <span className="text-xl font-bold text-white/50">
                      {guild.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate group-hover:text-accent-light transition-colors">
                    {guild.name}
                  </p>
                  {guild.approximate_member_count && (
                    <p className="text-sm text-white/40">
                      {guild.approximate_member_count.toLocaleString()} members
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
