// components/FullPageLoader.tsx
import { BookOpen } from 'lucide-react';

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm font-medium text-gray-700">
          Chargement de votre espace EduConnect...
        </p>
      </div>
    </div>
  );
}
