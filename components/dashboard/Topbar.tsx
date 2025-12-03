'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      router.push('/'); // ✅ retour à la page d’accueil
    } catch (e) {
      console.error('logout error', e);
      router.push('/'); // fallback : on renvoie quand même vers l’accueil
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ✅ Même logo que la page d’accueil */}
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-blue-600" />
          <span className="text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EduConnect
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isStudent && (
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs sm:text-sm text-blue-700">
              Espace étudiant
            </span>
          )}
          {isTutor && (
            <span className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs sm:text-sm text-purple-700">
              Espace tuteur
            </span>
          )}

          {/* Avatar cliquable => /profile */}
          <Link
            href="/profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            aria-label="Voir mon profil"
          >
            {initialsOf(fullName)}
          </Link>

          {/* ✅ Bouton Déconnexion qui renvoie vers l’accueil */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Déconnexion…' : 'Déconnexion'}
          </Button>
        </div>
      </div>
    </header>
  );
}
