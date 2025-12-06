// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SupabaseAuthSync from "@/components/SupabaseAuthSync";
import NotificationsProvider from "@/components/NotificationsProvider";
import { Toaster } from "sonner";
import { AppProviders } from "./providers";
import { Viewport } from "next/dist/lib/metadata/types/extra-types";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EduConnect",
  description: "Plateforme de mise en relation étudiants / tuteurs",
   icons: {
    icon: '/favicon.ico',       // 👈 ton fichier dans /public
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};
   
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.className} suppressHydrationWarning>
      <body>
        <AppProviders>
          <SupabaseAuthSync />
          <NotificationsProvider>
            {children}
          </NotificationsProvider>
          <Toaster richColors closeButton />
        </AppProviders>
      </body>
    </html>
  );
}
