'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  const isStudent = pathname?.startsWith('/dashboard/student');
  const isTutor = pathname?.startsWith('/dashboard/tutor');

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-500 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EduConnect
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Badge rôle */}
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

          {/* Avatar cliquable = /profile */}
          <Link
            href="/profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            aria-label="Voir mon profil"
          >
            {initialsOf(fullName)}
          </Link>

          {/* Déconnexion */}
          <Link href="/auth/logout">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs sm:text-sm"
            >
              Déconnexion
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
