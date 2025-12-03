// components/FullPageLoader.tsx
import { BookOpen } from 'lucide-react';

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        {/* Même livre que sur la page d'accueil */}
        <BookOpen className="w-10 h-10 text-blue-600" />
        <p className="text-sm font-medium text-gray-700">
          Chargement de votre espace EduConnect...
        </p>
      </div>
    </div>
  );
}
