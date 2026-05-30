import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Music2, Zap, Globe, Headphones } from 'lucide-react';

export default async function HomePage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
      <div className="text-center max-w-2xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Music2 className="w-12 h-12 text-accent" />
          <h1 className="text-6xl font-display font-bold">Harmonia</h1>
        </div>
        <p className="text-xl text-white/60 mb-8 font-body">
          A Discord music bot that feels like Spotify. Search YouTube & Spotify, build playlists,
          and control playback from a beautiful web dashboard.
        </p>

        <a
          href="/api/auth/signin/discord"
          className="inline-flex items-center gap-3 bg-accent hover:bg-accent-hover text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z" />
          </svg>
          Login with Discord
        </a>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            { icon: Zap, title: 'Real-time Control', desc: 'Control playback from the web dashboard. Changes sync instantly.' },
            { icon: Globe, title: 'YouTube + Spotify', desc: 'Search both platforms. All audio plays via YouTube.' },
            { icon: Headphones, title: 'Personal Playlists', desc: 'Build, share, and import playlists. No duplicated track metadata.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-surface rounded-xl p-6">
              <Icon className="w-8 h-8 text-accent mb-3" />
              <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
              <p className="text-white/50 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
