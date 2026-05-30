import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import NowPlayingBar from '@/components/NowPlayingBar';
import QueryProvider from '@/components/QueryProvider';
import SocketProvider from '@/components/SocketProvider';

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { guildId: string };
}) {
  const session = await auth();
  const s = session as typeof session & { userId?: string };
  if (!s?.userId) redirect('/');

  return (
    <QueryProvider>
      <SocketProvider guildId={params.guildId}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar guildId={params.guildId} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto p-6 relative z-10">{children}</main>
            <NowPlayingBar guildId={params.guildId} />
          </div>
        </div>
      </SocketProvider>
    </QueryProvider>
  );
}
