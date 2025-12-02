// app/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-red-50 px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-700">
            Une erreur est survenue
          </h1>
          <p className="text-sm text-red-600">
            Désolé, quelque chose s’est mal passé. Vous pouvez réessayer.
          </p>
          <Button onClick={() => reset()} className="bg-red-600 hover:bg-red-700">
            Réessayer
          </Button>
        </div>
      </body>
    </html>
  );
}
