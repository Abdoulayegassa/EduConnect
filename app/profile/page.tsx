'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import Topbar from '@/components/dashboard/Topbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GraduationCap, Users, Loader2 } from 'lucide-react';

type Role = 'student' | 'tutor' | 'admin';

type ProfileRow = {
  id: string;
  role: Role | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;

  // Étudiant
  level: string | null;
  university: string | null;

  // Tuteur
  degree: string | null;
  subjects: string[] | null;
  availability_codes: string[] | null;
  modes: string[] | null;
};

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type Pod = 'morning' | 'afternoon' | 'evening';

const DAY_LABEL: Record<Day, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
};

const POD_LABEL: Record<Pod, string> = {
  morning: 'Matin (8h-12h)',
  afternoon: 'Après-midi (12h-18h)',
  evening: 'Soir (18h-22h)',
};

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const PODS: Pod[] = ['morning', 'afternoon', 'evening'];

const keyFor = (d: Day, p: Pod) => `${d}:${p}`;

const SUBJECTS = ['Mathématiques', 'Physique', 'Chimie', 'Français', 'Anglais', 'Informatique'];

export default function ProfilePage() {
  const router = useRouter();
  const supa = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // États de formulaire
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState('');
  const [university, setUniversity] = useState('');
  const [degree, setDegree] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availabilityKeys, setAvailabilityKeys] = useState<string[]>([]);

  const isStudent = profile?.role === 'student';
  const isTutor = profile?.role === 'tutor';

  // Charge le profil (et le crée si inexistant)
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supa.auth.getUser();

        if (!user) {
          window.location.replace('/auth/login');
          return;
        }

        // 1) Essayer de récupérer le profil existant
        let { data, error } = await supa
          .from('profiles')
          .select(
            `
              id, role, email, full_name, phone,
              level, university,
              degree, subjects, availability_codes, modes
            `
          )
          .eq('id', user.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        // 2) Si pas de profil => on en crée un minimal
        if (!data) {
          const roleFromMeta =
            ((user.user_metadata as any)?.role as Role | undefined) ?? 'student';

          const full_name_from_meta =
            (user.user_metadata as any)?.full_name ??
            user.email?.split('@')[0] ??
            'Utilisateur';

          const insertPayload = {
            id: user.id,
            role: roleFromMeta,
            email: user.email,
            full_name: full_name_from_meta,
            phone: null,
            level: null,
            university: null,
            degree: null,
            subjects: [] as string[],
            availability_codes: [] as string[],
            modes: roleFromMeta === 'tutor' ? ['visio'] : null,
          };

          const { data: created, error: insErr } = await supa
            .from('profiles')
            .insert(insertPayload)
            .select(
              `
                id, role, email, full_name, phone,
                level, university,
                degree, subjects, availability_codes, modes
              `
            )
            .single<ProfileRow>();

          if (insErr) {
            setError(insErr.message);
            setLoading(false);
            return;
          }

          data = created;
        }

        // 3) On a forcément un profil ici
        setProfile(data);

        // Init des champs du formulaire
        setFullName(data.full_name ?? '');
        setPhone(data.phone ?? '');
        setLevel(data.level ?? '');
        setUniversity(data.university ?? '');
        setDegree(data.degree ?? '');
        setSubjects(data.subjects ?? []);
        setAvailabilityKeys(data.availability_codes ?? []);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement du profil.');
      } finally {
        setLoading(false);
      }
    })();
  }, [supa]);

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject],
    );
  };

  const toggleAvailabilityKey = (k: string) => {
    setAvailabilityKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  };

  const handleSave = async () => {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      if (!fullName.trim()) {
        setError('Le nom complet est obligatoire.');
        setSaving(false);
        return;
      }

      const payload: Partial<ProfileRow> & { modes?: string[] | null } = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        // Étudiant
        level: isStudent ? level || null : profile.level,
        university: isStudent ? university || null : profile.university,
        // Tuteur
        degree: isTutor ? degree || null : profile.degree,
        subjects: isTutor ? subjects : profile.subjects,
        availability_codes: isTutor ? availabilityKeys : profile.availability_codes,
        modes: isTutor ? ['visio'] : profile.modes, // visio seulement
      };

      const { error } = await supa
        .from('profiles')
        .update(payload)
        .eq('id', profile.id);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      setSuccess('Profil mis à jour avec succès.');
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
            }
          : prev,
      );

      // ✅ redirection vers le dashboard
router.push('/dashboard');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise à jour du profil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6 flex items-center justify-center h-screen">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Chargement du profil…</span>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-red-600">
          Impossible de charger votre profil. Veuillez réessayer.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Topbar fullName={profile.full_name || undefined} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Mon profil
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Mets à jour tes informations pour garder ton profil à jour.
          </p>
        </div>

        <Card className="shadow-sm border-0">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isStudent ? (
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Users className="w-5 h-5 text-purple-600" />
                  )}
                  <span>{profile.full_name || '—'}</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  {isStudent
                    ? "Profil étudiant"
                    : isTutor
                    ? "Profil tuteur (visioconférence uniquement)"
                    : "Profil"}
                </CardDescription>
              </div>
              <Badge variant="outline">
                {isStudent ? 'Étudiant' : isTutor ? 'Tuteur' : profile.role}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="general">Informations générales</TabsTrigger>
                {isTutor && (
                  <TabsTrigger value="tutor">Profil tuteur</TabsTrigger>
                )}
              </TabsList>

              {/* Onglet infos générales */}
              <TabsContent value="general" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nom complet</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ton nom et prénom"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={profile.email || ''}
                      disabled
                      className="mt-2 bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+223 70 00 00 00"
                    className="mt-2"
                  />
                </div>

                {isStudent && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Niveau d&apos;études</Label>
                      <Input
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        placeholder="Ex : Terminale, L2, M1…"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Établissement</Label>
                      <Input
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="Nom de l’école / université"
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Onglet tuteur */}
              {isTutor && (
                <TabsContent value="tutor" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Diplôme principal</Label>
                      <Input
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        placeholder="Ex : Master en Mathématiques"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Format</Label>
                      <Input
                        value="Visioconférence"
                        disabled
                        className="mt-2 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Le mode présentiel a été désactivé. Les cours se font en visio.
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label>Matières enseignées</Label>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      Clique pour sélectionner / désélectionner.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map((s) => {
                        const selected = subjects.includes(s);
                        return (
                          <Badge
                            key={s}
                            variant={selected ? 'default' : 'outline'}
                            className={`cursor-pointer transition ${
                              selected
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'hover:bg-purple-50'
                            }`}
                            onClick={() => toggleSubject(s)}
                          >
                            {s}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Disponibilités (grille)</Label>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      Clique sur les créneaux où tu es disponible.
                    </p>

                    <div className="overflow-x-auto rounded-lg border bg-white">
                      <table className="min-w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-3 text-left font-medium text-gray-600">
                              Tranche / Jour
                            </th>
                            {DAYS.map((d) => (
                              <th
                                key={d}
                                className="p-3 text-center font-medium text-gray-600"
                              >
                                {DAY_LABEL[d]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PODS.map((p) => (
                            <tr key={p} className="border-t">
                              <td className="p-3 font-medium text-gray-700">
                                {POD_LABEL[p]}
                              </td>
                              {DAYS.map((d) => {
                                const k = keyFor(d, p);
                                const checked = availabilityKeys.includes(k);
                                return (
                                  <td key={k} className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => toggleAvailabilityKey(k)}
                                      className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition ${
                                        checked
                                          ? 'bg-purple-600 text-white border-purple-600'
                                          : 'bg-white text-gray-700 hover:bg-gray-50'
                                      }`}
                                      aria-pressed={checked}
                                    >
                                      {checked ? '✓' : ''}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {error && (
              <p className="text-sm text-red-600 mt-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-600 mt-2">
                {success}
              </p>
            )}

            <div className="flex justify-end pt-4 border-t mt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  'Enregistrer les modifications'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
