'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePathname } from 'next/navigation';

type TopbarProps = {
  fullName?: string;
};

export default function Topbar({ fullName }: TopbarProps) {
  const pathname = usePathname();

  const isStudent = pathname?.startsWith('/dashboard/student');
  const isTutor = pathname?.startsWith('/dashboard/tutor');

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo inline au lieu de <Brand /> */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">
            EC
          </span>
          <span className="text-base sm:text-lg tracking-tight">
            EduConnect
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Petit indicateur de rôle */}
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

          {/* Nom utilisateur */}
          {fullName && (
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {fullName}
            </span>
          )}

          {/* Toggle dark / light */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
