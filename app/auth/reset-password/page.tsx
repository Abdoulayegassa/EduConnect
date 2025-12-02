'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LockKeyhole, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const supa = supabaseBrowser();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supa.auth.updateUser({ password });

      if (error) throw error;

      setMessage(
        'Votre mot de passe a été mis à jour avec succès. Redirection vers la page de connexion...'
      );
      toast.success('Mot de passe mis à jour, vous allez être redirigé.');

      // 🔁 Redirection automatique après 3 secondes
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre à jour le mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-purple-100">
                <LockKeyhole className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Nouveau mot de passe
                </h1>
                <p className="text-sm text-gray-600">
                  Choisissez un mot de passe solide pour sécuriser votre compte
                  EduConnect.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="mt-2"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
              </Button>

              {message && (
                <div className="mt-3 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                  <p>{message}</p>
                </div>
              )}
              {error && (
                <p className="text-sm text-red-600 mt-2">
                  {error}
                </p>
              )}
            </form>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Si vous n’êtes pas à l’origine de cette demande, contactez immédiatement
              le support EduConnect.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
