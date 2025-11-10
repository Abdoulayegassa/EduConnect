'use client';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import * as React from 'react';

type LogoProps = { className?: string };

export function BrandLogo({ className = 'h-8 w-8' }: LogoProps) {
  // 👇 Strictement le même rendu que ta page d'accueil
  return <BookOpen className={`${className} text-blue-600`} aria-hidden="true" />;
}

export function BrandWordmark({ className = 'text-2xl font-bold' }: { className?: string }) {
  return (
    <span className={`${className} bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`}>
      EduConnect
    </span>
  );
}

// Combo logo + nom (utile dans les navbars)
export function BrandLink({
  href = '/',
  logoClassName = 'h-8 w-8',
  wordmarkClassName = 'text-2xl font-bold',
}: {
  href?: string;
  logoClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <Link href={href} className="flex items-center space-x-2">
      <BrandLogo className={logoClassName} />
      <BrandWordmark className={wordmarkClassName} />
    </Link>
  );
}
