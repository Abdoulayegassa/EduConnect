// components/dashboard/Topbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TopbarProps = {
  fullName?: string;
};

function getInitials(name?: string | null) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Topbar({ fullName }: TopbarProps) {
  const pathname = usePathname();

  const isStudent = pathname?.startsWith('/dashboard/student');
  const isTutor = pathname?.startsWith('/dashboard/tutor');

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo BookOpen + EduConnect */}
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-blue-600" />
          <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EduConnect
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Badge rôle (comme avant) */}
          {isStudent && (
            <span className="hidden sm:inline text-xs sm:text-sm px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              Espace étudiant
            </span>
          )}
          {isTutor && (
            <span className="hidden sm:inline text-xs sm:text-sm px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              Espace tuteur
            </span>
          )}

          {/* Nom + initiales utilisateur */}
          {fullName && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                {getInitials(fullName)}
              </div>
              <span className="hidden sm:inline text-sm text-gray-700">
                {fullName}
              </span>
            </div>
          )}

          {/* Exemple de bouton profil si tu veux (optionnel) */}
          {/* <Link href="/profile">
            <Button variant="outline" size="sm">
              Mon profil
            </Button>
          </Link> */}
        </div>
      </div>
    </header>
  );
}
