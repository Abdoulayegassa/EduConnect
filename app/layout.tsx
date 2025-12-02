// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SupabaseAuthSync from "@/components/SupabaseAuthSync";
import NotificationsProvider from "@/components/NotificationsProvider";
import { Toaster } from "sonner";
import { AppProviders } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EduConnect",
  description: "App",
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
