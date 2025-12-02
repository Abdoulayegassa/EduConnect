'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, LogOut } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

type TopbarProps = {
  fullName?: string;
};

function initials(name?: string | null) {
  if (!name) return 'EC';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export default function Topbar({ fullName }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supa = useMemo(() => supabaseBrowser(), []);

  const isStudent = pathname?.startsWith('/dashboard/student');
  const isTutor = pathname?.startsWith('/dashboard/tutor');

  const handleLogout = async () => {
    try {
      await supa.auth.signOut();
      // redirection vers la page de login
      router.replace('/auth/login');
    } catch (e) {
      console.error('logout error', e);
    }
  };

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo (BookOpen + EduConnect) */}
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <span className="text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EduConnect
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Badge rôle */}
          {isStudent && (
            <span className="text-xs sm:text-sm px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              Espace étudiant
            </span>
          )}
          {isTutor && (
            <span className="text-xs sm:text-sm px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              Espace tuteur
            </span>
          )}

          {/* Avatar (initiales) = lien vers /profile */}
          {fullName && (
            <Link
              href="/profile"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-semibold shadow-sm hover:opacity-90 transition"
              title="Voir mon profil"
            >
              {initials(fullName)}
            </Link>
          )}

          {/* Bouton déconnexion */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
