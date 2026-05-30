import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { prisma } from '@harmonia/db';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    accessToken?: string;
  }
}

export const { handlers, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env['DISCORD_CLIENT_ID'] ?? '',
      clientSecret: process.env['DISCORD_CLIENT_SECRET'] ?? '',
      authorization: { params: { scope: 'identify guilds' } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.id) return false;
      const discordProfile = profile as {
        id?: string;
        username?: string;
        discriminator?: string;
        avatar?: string;
      } | undefined;

      if (discordProfile?.id) {
        await prisma.user.upsert({
          where: { id: discordProfile.id },
          update: {
            username: discordProfile.username ?? user.name ?? 'unknown',
            discriminator: discordProfile.discriminator ?? '0',
            avatarUrl: user.image ?? null,
          },
          create: {
            id: discordProfile.id,
            username: discordProfile.username ?? user.name ?? 'unknown',
            discriminator: discordProfile.discriminator ?? '0',
            avatarUrl: user.image ?? null,
          },
        });
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as { id?: string; discriminator?: string };
        token['discordId'] = discordProfile.id;
        token['accessToken'] = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s['userId'] = token['discordId'];
      s['accessToken'] = token['accessToken'];
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
});
