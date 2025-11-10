'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { BrandLink } from '@/components/brand/brand';

type Props = { fullName?: string | null };

function initials(name?: string | null) {
  if (!name) return '??';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase();
}

export default function Topbar({ fullName }: Props) {
  const router = useRouter();
  const supa = supabaseBrowser();

  async function logout() {
    await supa.auth.signOut();
    router.replace('/auth/login');
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-screen-xl h-12 px-4 flex items-center justify-between">
        {/* GAUCHE : logo + nom (identique à la home) */}
        <BrandLink href="/" logoClassName="h-8 w-8" wordmarkClassName="text-2xl font-bold" />

        {/* DROITE : initiales + menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-9 w-9 rounded-full bg-gray-200 text-gray-700 font-semibold flex items-center justify-center"
              title={fullName || 'Utilisateur'}
              aria-label="Menu utilisateur"
            >
              {initials(fullName)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild><Link href="/profile">Mon profil</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>Se déconnecter</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
