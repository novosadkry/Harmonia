import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Music2, Zap, Globe, Headphones } from 'lucide-react';
import SignInButton from '@/components/SignInButton';

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

        <SignInButton />

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
