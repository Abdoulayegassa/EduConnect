'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ArrowLeft, Users, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  // 🔐 On sécurise la création du client Supabase
  let supa: ReturnType<typeof supabaseBrowser> | null = null;
  try {
    supa = supabaseBrowser();
  } catch (err) {
    console.error('[login] supabase init error', err);
  }

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [activeTab, setActiveTab] = useState<'student' | 'tutor'>('student');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleInputChange = (field: 'email' | 'password', value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  async function handleSubmit(e: FormEvent, roleChoice: 'student' | 'tutor') {
    e.preventDefault();
    setErrMsg(null);

    if (!supa) {
      const msg =
        'Erreur de configuration Supabase en local. Vérifie ton fichier .env.local.';
      toast.error(msg);
      console.error(msg);
      return;
    }

    setLoading(true);

    try {
      const email = formData.email.trim().toLowerCase();

      // 1) Auth
      const { error: authErr } = await supa.auth.signInWithPassword({
        email,
        password: formData.password,
      });
      if (authErr) throw authErr;

      const {
        data: { user },
      } = await supa.auth.getUser();
      if (!user) throw new Error('Connexion impossible.');

      // 2) Récup profil
      const { data: profile, error: pErr } = await supa
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (pErr) throw pErr;

      // 3) Si pas de profil, on le crée
      let effectiveRole = profile?.role as 'student' | 'tutor' | null;

      if (!effectiveRole) {
        const isTutor = roleChoice === 'tutor';

        const { data: insertedProfile, error: insErr } = await supa
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email?.toLowerCase() ?? email,
            full_name:
              (user.user_metadata as any)?.full_name ??
              user.email?.split('@')[0] ??
              'Utilisateur',
            role: roleChoice,
            verified: isTutor ? false : true,
          })
          .select('role')
          .maybeSingle();

        if (insErr) throw insErr;
        effectiveRole = (insertedProfile?.role as any) ?? roleChoice;
      }

      // 4) Vérif cohérence rôle / onglet
      if (effectiveRole !== roleChoice) {
        await supa.auth.signOut();
        throw new Error(
          roleChoice === 'student'
            ? "Ce compte n'est pas un compte Étudiant. Choisissez l'onglet « Tuteur »."
            : "Ce compte n'est pas un compte Tuteur. Choisissez l'onglet « Étudiant ».",
        );
      }

      // 5) OK → redirection
      toast.success('Connexion réussie, redirection en cours...');
      window.location.href = '/dashboard';
    } catch (e: any) {
      const msg = e?.message ?? 'Échec de connexion.';
      setErrMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            {/* ✅ même icône que sur la home */}
            <BookOpen className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EduConnect
            </span>
          </Link>
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Se connecter
            </h1>
            <p className="text-gray-600">Accédez à votre espace personnel</p>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader>
              <Tabs
                value={activeTab}
                onValueChange={v => {
                  setActiveTab(v as 'student' | 'tutor');
                  setErrMsg(null);
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger
                    value="student"
                    className="flex items-center space-x-2"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Étudiant</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="tutor"
                    className="flex items-center space-x-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Tuteur</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab}>
                {/* Étudiant */}
                <TabsContent value="student">
                  <form
                    onSubmit={e => handleSubmit(e, 'student')}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="student-email">Email</Label>
                      <Input
                        id="student-email"
                        type="email"
                        value={formData.email}
                        onChange={e =>
                          handleInputChange('email', e.target.value)
                        }
                        placeholder="votre.email@example.com"
                        required
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="student-password">Mot de passe</Label>
                      <Input
                        id="student-password"
                        type="password"
                        value={formData.password}
                        onChange={e =>
                          handleInputChange('password', e.target.value)
                        }
                        placeholder="Votre mot de passe"
                        required
                        className="mt-2"
                      />
                    </div>
                    <div className="text-right">
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <Button
                      disabled={loading}
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {loading
                        ? 'Connexion…'
                        : 'Se connecter comme étudiant'}
                    </Button>
                    {errMsg && (
                      <p className="text-red-600 text-sm mt-2">{errMsg}</p>
                    )}
                  </form>
                </TabsContent>

                {/* Tuteur */}
                <TabsContent value="tutor">
                  <form
                    onSubmit={e => handleSubmit(e, 'tutor')}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="tutor-email">Email</Label>
                      <Input
                        id="tutor-email"
                        type="email"
                        value={formData.email}
                        onChange={e =>
                          handleInputChange('email', e.target.value)
                        }
                        placeholder="votre.email@example.com"
                        required
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tutor-password">Mot de passe</Label>
                      <Input
                        id="tutor-password"
                        type="password"
                        value={formData.password}
                        onChange={e =>
                          handleInputChange('password', e.target.value)
                        }
                        placeholder="Votre mot de passe"
                        required
                        className="mt-2"
                      />
                    </div>
                    <div className="text-right">
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm text-purple-600 hover:underline"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <Button
                      disabled={loading}
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {loading
                        ? 'Connexion…'
                        : 'Se connecter comme tuteur'}
                    </Button>
                    {errMsg && (
                      <p className="text-red-600 text-sm mt-2">{errMsg}</p>
                    )}
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-6 text-center text-sm text-gray-600">
                Pas encore de compte ?{' '}
                <Link
                  href="/auth/register"
                  className="text-blue-600 hover:underline"
                >
                  S&apos;inscrire
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
