'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabaseBrowser } from '@/lib/supabase/browser';

type TopbarProps = {
  fullName?: string;
};

function initialsOf(name?: string) {
  if (!name) return 'EC';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

export default function Topbar({ fullName }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const isStudent = pathname?.startsWith('/dashboard/student');
  const isTutor = pathname?.startsWith('/dashboard/tutor');

  async function handleLogout() {
    try {
      setLoggingOut(true);
      const supa = supabaseBrowser();
      await supa.auth.signOut();
      router.push('/'); // retour à l'accueil
    } catch (e) {
      console.error('logout error', e);
      router.push('/');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-4 lg:px-8">
        {/* Logo identique à la page d'accueil, mais un peu plus compact sur mobile */}
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
          <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
          <span className="text-sm sm:text-base md:text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EduConnect
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Badges rôle : cachés sur très petit écran */}
          {isStudent && (
            <span className="hidden sm:inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs sm:text-sm text-blue-700">
              Espace étudiant
            </span>
          )}
          {isTutor && (
            <span className="hidden sm:inline-flex rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs sm:text-sm text-purple-700">
              Espace tuteur
            </span>
          )}

          {/* Menu sur l’avatar : Mon profil + Déconnexion */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                aria-label="Ouvrir le menu utilisateur"
              >
                {initialsOf(fullName)}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
              {fullName && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Connecté en tant que
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2 text-sm font-medium truncate">
                    {fullName}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem asChild>
                <Link href="/profile">
                  Mon profil
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600"
              >
                {loggingOut ? 'Déconnexion…' : 'Déconnexion'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
