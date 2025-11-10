import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import SupabaseAuthSync from '@/components/SupabaseAuthSync'; // ⬅️ ajoute ceci

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EduConnect',
  description: 'App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* ⬇️ Monte une seule fois le sync d’auth */}
        <SupabaseAuthSync />
        {children}
      </body>
    </html>
  );
}
