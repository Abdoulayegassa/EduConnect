'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const supa = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { error } = await supa.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      // Message neutre pour ne pas révéler si l’email existe ou non
      setMessage(
        "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
      );
      toast.success("Vérifiez votre boîte mail pour réinitialiser votre mot de passe.");
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="space-y-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour à la connexion
            </Link>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-100">
                <KeyRound className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Mot de passe oublié
                </h1>
                <p className="text-sm text-gray-600">
                  Entrez votre email, nous vous enverrons un lien sécurisé pour
                  définir un nouveau mot de passe.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="mt-2 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@example.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Envoi du lien…' : 'Envoyer le lien de réinitialisation'}
              </Button>

              {message && (
                <p className="text-sm text-green-600 mt-2">
                  {message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 mt-2">
                  {error}
                </p>
              )}
            </form>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Vous recevrez un email EduConnect avec un lien valable quelques minutes.
              Pensez à vérifier votre dossier <strong>Spam / Promotions</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
