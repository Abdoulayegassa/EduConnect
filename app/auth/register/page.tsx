'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowLeft, Users, GraduationCap } from 'lucide-react';

type Day = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
type Pod = 'morning'|'afternoon'|'evening';

const SUBJECTS = ['Mathématiques','Physique','Chimie','Français','Anglais','Informatique'];

const SCHOOL_LEVELS = [
  'Collège (6ème - 9ème)',
  'Lycée (10ème - 11ème - Terminale)',
  'Licence (L1 - L3)',
  'Master (M1 - M2)',
  'Professionnel',
];

// Grille 7×3 (jours x tranches)
const DAY_LABEL: Record<Day,string> = {
  mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi',
  fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche',
};
const POD_LABEL: Record<Pod,string> = {
  morning: 'Matin (8h-12h)',
  afternoon: 'Après-midi (12h-18h)',
  evening: 'Soir (18h-22h)',
};
const DAYS: Day[] = ['mon','tue','wed','thu','fri','sat','sun'];
const PODS: Pod[] = ['morning','afternoon','evening'];
const keyFor = (day: Day, pod: Pod) => `${day}:${pod}`;

type Role = 'student' | 'tutor';


interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  role: Role;

  // Student
  schoolLevel?: string;
  university?: string;

  // Tutor
  subjects?: string[];
  degree?: string;
  experience?: string;
  availabilityKeys?: string[]; // ex: ['mon:morning','tue:evening']
  modesVisio?: boolean;         // ⟵ AJOUTER
  modesPresentiel?: boolean;     // UI unique, mappé en ['visio'] | ['presentiel'] | ['visio','presentiel']
}

// Helpers
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function RegisterPage() {
  const supa = supabaseBrowser();
  const searchParams = useSearchParams();
  const roleParam = (searchParams.get('role') as Role) || 'student';

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: roleParam,
    // tuteur
    degree: '',
    subjects: [],
    availabilityKeys: [],
     modesVisio: true,
    modesPresentiel: false,
  });

  const [step, setStep] = useState(1);
  const totalSteps = formData.role === 'student' ? 2 : 3;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isStudent = formData.role === 'student';
  const primaryBg = isStudent ? 'bg-blue-600' : 'bg-purple-600';
  const primaryBgHover = isStudent ? 'hover:bg-blue-700' : 'hover:bg-purple-700';
  const primaryBgLight = isStudent ? 'bg-blue-100' : 'bg-purple-100';
  const primaryText = isStudent ? 'text-blue-600' : 'text-purple-600';
  const barColor = isStudent ? 'bg-blue-600' : 'bg-purple-600';

  const handleInputChange = (field: keyof FormData, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const toggleSubject = (subject: string) =>
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects?.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...(prev.subjects || []), subject],
    }));

  const toggleAvailabilityKey = (k: string) =>
    setFormData(prev => ({
      ...prev,
      availabilityKeys: prev.availabilityKeys?.includes(k)
        ? prev.availabilityKeys.filter(x => x !== k)
        : [...(prev.availabilityKeys || []), k],
    }));

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (formData.password !== formData.confirmPassword) {
      setErr('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const full_name = `${formData.firstName} ${formData.lastName}`.trim();

      // --- Mapping tutor modes
     let modes: string[] | null = null;
if (!isStudent) {
  const out: string[] = [];
  if (formData.modesVisio) out.push('visio');
  if (formData.modesPresentiel) out.push('presentiel');
  if (out.length === 0) {
    setErr('Sélectionnez au moins un format (Visio ou Présentiel).');
    setLoading(false);
    return;
  }
  modes = out;
}


      // --- subject_slugs
      const subjectsArr = isStudent ? [] : (formData.subjects ?? []);
      const subject_slugs = isStudent ? [] : subjectsArr.map(normalize);

      // --- availability codes (grille)
      // On stocke "availability_codes" (ex: ["mon:morning","sat:evening"])
      const availability_codes = isStudent ? null : (formData.availabilityKeys ?? []);

      // (Optionnel: si tu veux également un champ legacy "availability" lisible côté UI)
      // const availability_legacy = availability_codes?.map(k => {
      //   const [d, p] = k.split(':') as [Day,Pod];
      //   return `${DAY_LABEL[d]} - ${POD_LABEL[p]}`;
      // }) ?? null;

      // 1) Signup
      const { data, error } = await supa.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: formData.role,
            full_name,
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Création utilisateur échouée.');

      // 2) Upsert profil
      const profilePayload: any = {
        id: data.user.id,
        role: formData.role,
        full_name,
        email: formData.email,

        // Étudiant
        level: isStudent ? (formData.schoolLevel ?? null) : null,
        university: isStudent ? (formData.university ?? null) : null,

        // Tuteur
        degree: !isStudent ? (formData.degree ?? null) : null,
        subjects: !isStudent ? subjectsArr : [],
        subject_slugs: !isStudent ? subject_slugs : [],
        availability_codes: !isStudent ? availability_codes : null, // << clé de cohérence
        modes: !isStudent ? modes : null,
        // experience: !isStudent ? (formData.experience ?? null) : null,
        // availability: availability_legacy, // si tu as conservé la colonne legacy
      };

      const hasSession = !!data.session;

      if (hasSession) {
        const { error: profErr } = await supa
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });
        if (profErr) throw profErr;

        window.location.href = '/dashboard';
      } else {
        // Si email de confirmation requis et RLS stricte, passe par une route API service_role
        const res = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profilePayload),
        });
        if (!res.ok) {
          let details = '';
          try { const j = await res.json(); details = j?.error ? `\nDétails: ${j.error}` : ''; } catch {}
          alert("Compte créé. Votre profil sera finalisé après confirmation de l'e-mail." + details +
                '\nOuvrez votre boîte mail pour confirmer, puis connectez-vous.');
        } else {
          alert('Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.');
        }
        window.location.href = '/auth/login';
      }
    } catch (e: any) {
      setErr(e?.message ?? "Erreur inconnue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
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

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${primaryBgLight}`}>
              {isStudent ? (
                <GraduationCap className={`w-8 h-8 ${primaryText}`} />
              ) : (
                <Users className={`w-8 h-8 ${primaryText}`} />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isStudent ? 'Créer mon compte étudiant' : 'Devenir tuteur'}
            </h1>
            <p className="text-gray-600">
              {isStudent
                ? 'Trouvez rapidement le tuteur parfait pour vos besoins'
                : 'Partagez vos connaissances et aidez des étudiants à réussir'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4 mb-4">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      stepNumber <= step ? `${barColor} text-white` : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {stepNumber}
                  </div>
                  {stepNumber < totalSteps && (
                    <div className={`w-12 h-1 mx-2 ${stepNumber < step ? barColor : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-gray-600">Étape {step} sur {totalSteps}</div>
          </div>

          <Card className="shadow-xl border-0">
            <form onSubmit={handleSubmit}>
              {/* Step 1: Basic Information */}
              {step === 1 && (
                <CardContent className="p-8">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Informations personnelles</CardTitle>
                    <CardDescription>Commençons par vos informations de base</CardDescription>
                  </CardHeader>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Prénom *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          placeholder="Votre prénom"
                          required
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Nom *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          placeholder="Votre nom"
                          required
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="votre.email@example.com"
                        required
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Numéro de téléphone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+223 70 00 00 00"
                        className="mt-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="password">Mot de passe *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          placeholder="Minimum 8 caractères"
                          required
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          placeholder="Répétez votre mot de passe"
                          required
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-8">
                    <Button type="button" onClick={nextStep} className={`${primaryBg} ${primaryBgHover}`}>
                      Continuer
                    </Button>
                  </div>
                </CardContent>
              )}

              {/* Step 2: Academic / Tutor core */}
              {step === 2 && (
                <CardContent className="p-8">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>{isStudent ? 'Niveau scolaire' : 'Matières, diplôme & format'}</CardTitle>
                    <CardDescription>
                      {isStudent ? "Indiquez votre niveau d'études" : 'Déclarez vos matières et votre format d’enseignement'}
                    </CardDescription>
                  </CardHeader>

                  <div className="space-y-6">
                    {isStudent ? (
                      <>
                        <div>
                          <Label>Niveau d&apos;études *</Label>
                          <Select value={formData.schoolLevel} onValueChange={(v) => handleInputChange('schoolLevel', v)}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Sélectionnez votre niveau" />
                            </SelectTrigger>
                            <SelectContent>
                              {SCHOOL_LEVELS.map((level) => (
                                <SelectItem key={level} value={level}>{level}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="university">Établissement</Label>
                          <Input
                            id="university"
                            value={formData.university}
                            onChange={(e) => handleInputChange('university', e.target.value)}
                            placeholder="Nom de votre école/université"
                            className="mt-2"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label>Matières enseignées *</Label>
                          <p className="text-sm text-gray-600 mt-1 mb-3">Sélectionnez les matières que vous maîtrisez</p>
                          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-4 border rounded-lg bg-white">
                            {SUBJECTS.map((s) => (
                              <Badge
                                key={s}
                                variant={formData.subjects?.includes(s) ? 'default' : 'outline'}
                                className={`cursor-pointer transition-colors ${
                                  formData.subjects?.includes(s) ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50'
                                }`}
                                onClick={() => toggleSubject(s)}
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="degree">Diplôme principal</Label>
                          <Input
                            id="degree"
                            value={formData.degree}
                            onChange={(e) => handleInputChange('degree', e.target.value)}
                            placeholder="Ex: Master en Mathématiques"
                            className="mt-2"
                          />
                        </div>

                       <div>
  <Label>Format d’enseignement *</Label>
  <p className="text-sm text-gray-600 mt-1 mb-3">Choisissez un ou deux formats</p>

  <div className="grid md:grid-cols-2 gap-3 mt-3">
    {/* Toggle Visio */}
    <button
      type="button"
      onClick={() => handleInputChange('modesVisio', !formData.modesVisio)}
      className={`border rounded-lg p-4 text-left transition ${
        formData.modesVisio ? 'border-purple-600 bg-purple-50' : 'hover:bg-gray-50'
      }`}
      aria-pressed={formData.modesVisio}
    >
      <div className="font-medium">Visio</div>
      <div className="text-sm text-gray-600">Cours en ligne</div>
      <div className="mt-2">
        <input
          type="checkbox"
          checked={!!formData.modesVisio}
          onChange={() => handleInputChange('modesVisio', !formData.modesVisio)}
          className="mr-2 align-middle"
          aria-label="Activer le format visio"
        />
        <span className="text-sm text-gray-700">Activer</span>
      </div>
    </button>

    {/* Toggle Présentiel */}
    <button
      type="button"
      onClick={() => handleInputChange('modesPresentiel', !formData.modesPresentiel)}
      className={`border rounded-lg p-4 text-left transition ${
        formData.modesPresentiel ? 'border-purple-600 bg-purple-50' : 'hover:bg-gray-50'
      }`}
      aria-pressed={formData.modesPresentiel}
    >
      <div className="font-medium">Présentiel</div>
      <div className="text-sm text-gray-600">En personne</div>
      <div className="mt-2">
        <input
          type="checkbox"
          checked={!!formData.modesPresentiel}
          onChange={() => handleInputChange('modesPresentiel', !formData.modesPresentiel)}
          className="mr-2 align-middle"
          aria-label="Activer le format présentiel"
        />
        <span className="text-sm text-gray-700">Activer</span>
      </div>
    </button>
  </div>
</div>


                        <div>
                          <Label>Expérience d&apos;enseignement</Label>
                          <Select value={formData.experience} onValueChange={(v) => handleInputChange('experience', v)}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Sélectionnez votre expérience" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beginner">Débutant (moins de 1 an)</SelectItem>
                              <SelectItem value="intermediate">Intermédiaire (1-3 ans)</SelectItem>
                              <SelectItem value="experienced">Expérimenté (3+ ans)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-between mt-8">
                    <Button type="button" variant="outline" onClick={prevStep}>
                      Retour
                    </Button>
                    <Button
  type="button"
  onClick={() => {
    if (!isStudent && !formData.modesVisio && !formData.modesPresentiel) {
      setErr('Sélectionnez au moins un format (Visio ou Présentiel).');
      return;
    }
    isStudent ? handleSubmit(new Event('submit') as any) : nextStep();
  }}
  className={`${primaryBg} ${primaryBgHover}`}
>
  {isStudent ? 'Créer mon compte' : 'Continuer'}
</Button>

                  </div>
                </CardContent>
              )}

              {/* Step 3: Tutor Availability (Grille 7×3) */}
              {step === 3 && formData.role === 'tutor' && (
                <CardContent className="p-8">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle>Disponibilités</CardTitle>
                    <CardDescription>Indiquez vos créneaux de disponibilité (cliquez sur les cases)</CardDescription>
                  </CardHeader>

                  <div className="space-y-6">
                    <div className="overflow-x-auto rounded-lg border bg-white">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-3 text-left font-medium text-gray-600">Tranche / Jour</th>
                            {DAYS.map(d => (
                              <th key={d} className="p-3 text-center font-medium text-gray-600">
                                {DAY_LABEL[d]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PODS.map(p => (
                            <tr key={p} className="border-t">
                              <td className="p-3 font-medium text-gray-700">{POD_LABEL[p]}</td>
                              {DAYS.map(d => {
                                const k = keyFor(d, p);
                                const checked = formData.availabilityKeys?.includes(k);
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

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => handleInputChange('availabilityKeys', [])}>
                        Vider la sélection
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handleInputChange(
                            'availabilityKeys',
                            Array.from(new Set([...(formData.availabilityKeys || []), ...DAYS.map(d => keyFor(d, 'evening'))]))
                          )
                        }
                      >
                        Ajouter tous les soirs
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const weekend = (['sat','sun'] as Day[]).flatMap(d => (['morning','afternoon','evening'] as Pod[]).map(p => keyFor(d,p)));
                          handleInputChange('availabilityKeys', Array.from(new Set([...(formData.availabilityKeys || []), ...weekend])));
                        }}
                      >
                        Tout le week-end
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between mt-8">
                    <Button type="button" variant="outline" onClick={prevStep}>
                      Retour
                    </Button>
                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                      Créer mon compte tuteur
                    </Button>
                  </div>
                </CardContent>
              )}
            </form>
          </Card>

          <div className="text-center mt-6 text-sm text-gray-600">
            Vous avez déjà un compte ?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Se connecter
            </Link>
          </div>

          {err && <p className="text-red-600 mt-4 text-sm text-center">{err}</p>}
          {loading && <p className="text-gray-500 mt-2 text-sm text-center">Création du compte…</p>}
        </div>
      </div>
    </div>
  );
}
