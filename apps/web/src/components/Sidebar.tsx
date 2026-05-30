'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Music2, ListMusic, BookOpen, Compass, Disc3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: 'now-playing', label: 'Now Playing', icon: Disc3 },
  { href: 'queue', label: 'Queue', icon: ListMusic },
  { href: 'playlists', label: 'My Playlists', icon: BookOpen },
  { href: 'discover', label: 'Discover', icon: Compass },
];

export default function Sidebar({ guildId }: { guildId: string }) {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-surface flex flex-col border-r border-white/5">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Music2 className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-lg">Harmonia</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `/dashboard/${guildId}/${href}`;
          const active = pathname === fullPath || pathname.startsWith(fullPath + '/');

          return (
            <Link
              key={href}
              href={fullPath}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-accent/20 text-accent-light'
                  : 'text-white/50 hover:text-white hover:bg-white/5',
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
        >
          ← All Servers
        </Link>
      </div>
    </div>
  );
}
