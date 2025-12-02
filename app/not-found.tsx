// app/not-found.tsx
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Page introuvable</h1>
        <p className="text-gray-600 max-w-md">
          Oups… Cette page n’existe pas ou n’est plus disponible. Retournez à votre tableau de bord ou à l’accueil EduConnect.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard">
            <Button>Aller au tableau de bord</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Retour à l’accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
