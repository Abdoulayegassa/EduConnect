'use client';

import { fmtDate } from '@/lib/dates';
import Topbar from '@/components/dashboard/Topbar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BookOpen, Calendar, Users, Star, Plus } from 'lucide-react';

type UUID = string;
type MatchStatus = 'proposed' | 'accepted' | 'declined' | 'expired';

type RequestRow = {
  id: string;
  subject: string | null;
  mode: 'visio' | 'presentiel' | null;
  status: 'open' | 'matched' | 'closed' | string;
  created_at: string | null;
  tutors_found?: number | null;
  // Normalisation créneaux
  slots_codes?: string[] | null;                     // vue v_student_requests
  slots?: { day: string; pod: string }[] | null;     // fallback table requests
};

type SessionRow = {
  id: UUID;
  request_id: UUID;
  jitsi_link: string | null;
  starts_at: string | null;
  mode: 'visio' | 'presentiel' | null;
};

type TutorCandidate = {
  match_id: UUID;
  request_id: UUID;
  status: MatchStatus;
  tutor: {
    id: UUID;
    full_name: string | null;
    subjects: string[] | null;
  };
};

// Libellés pour les créneaux
const DAY_SHORT: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam', sun: 'Dim',
};
const POD_LABEL: Record<string, string> = {
  morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir',
};

function SlotPill({ code }: { code: string }) {
  const [day, pod] = (code ?? '').split(':');
  return (
    <span className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700">
      {(DAY_SHORT[day] ?? day ?? '—')} · {(POD_LABEL[pod] ?? pod ?? '—')}
    </span>
  );
}

// Petit debounce pour limiter les reloads successifs
function useDebouncedCallback(cb: () => void, delay = 250) {
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => cb(), delay);
  }, [cb, delay]);
}

export default function StudentDashboard() {
  const supa = useMemo(() => supabaseBrowser(), []);
  const search = useSearchParams();
  const created = search.get('created') === '1';

  const [activeTab, setActiveTab] = useState<'requests' | 'sessions'>('requests');
  const [loading, setLoading] = useState(true);

  const [profileInfo, setProfileInfo] = useState<{ full_name?: string | null; level?: string | null; university?: string | null; }>({});
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [matchesMap, setMatchesMap] = useState<Map<UUID, TutorCandidate[]>>(new Map());
  const [studentId, setStudentId] = useState<UUID | null>(null);

  // refs pour limiter les effets secondaires
  const reqIdsRef = useRef<Set<UUID>>(new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>['channel']> | null>(null);

  const getStatusBadge = (s?: MatchStatus | string) => {
    if (s === 'accepted') return 'bg-green-100 text-green-800';
    if (s === 'proposed') return 'bg-yellow-100 text-yellow-800';
    if (s === 'declined') return 'bg-red-100 text-red-800';
    if (s === 'expired') return 'bg-gray-200 text-gray-700';
    return 'bg-gray-100 text-gray-800';
  };

  const modeLabel = (m?: 'visio' | 'presentiel' | null) =>
    m === 'visio' ? 'Visioconférence' : m === 'presentiel' ? 'Présentiel' : '—';

  const initials = (name?: string | null) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  };

  const reloadData = useCallback(async () => {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return;
    setStudentId(user.id as UUID);

    // 1) demandes via vue normalisée (fallback table requests)
    const { data: reqs, error: eReq } = await supa
      .from('v_student_requests')
      .select('id, subject, mode, slots_codes, status, created_at, tutors_found')
      .order('created_at', { ascending: false });

    if (eReq) {
      const { data: reqsFallback } = await supa
        .from('requests')
        .select('id, subject, mode, slots, status, created_at')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      const rf = (reqsFallback ?? []) as RequestRow[];
      setRequests(rf);
      reqIdsRef.current = new Set(rf.map(x => x.id));
    } else {
      const r = (reqs ?? []) as RequestRow[];
      setRequests(r);
      reqIdsRef.current = new Set(r.map(x => x.id));
    }

    const ids = Array.from(reqIdsRef.current);

    // 2) sessions via vue
    const { data: sess } = await supa
      .from('v_user_sessions')
      .select('id, request_id,starts_at, mode, jitsi_link')
      .order('starts_at', { ascending: false });

    setSessions((sess ?? []) as SessionRow[]);

    // 3) matches groupés
    if (ids.length) {
      const { data: rawMatches } = await supa
        .from('matches')
        .select(`
          id, request_id, status, updated_at,
          tutor:profiles!inner(id, full_name, subjects)
        `)
        .in('request_id', ids)
        .limit(1000);

      const grouped = new Map<UUID, TutorCandidate[]>();
      (rawMatches ?? []).forEach((m: any) => {
        const arr = grouped.get(m.request_id) ?? [];
        arr.push({
          match_id: m.id as UUID,
          request_id: m.request_id as UUID,
          status: m.status as MatchStatus,
          tutor: {
            id: m.tutor.id as UUID,
            full_name: m.tutor.full_name,
            subjects: m.tutor.subjects,
          }
        });
        grouped.set(m.request_id as UUID, arr);
      });
      setMatchesMap(grouped);
    } else {
      setMatchesMap(new Map());
    }
  }, [supa]);

  const debouncedReload = useDebouncedCallback(reloadData, 250);

  // Auth/profile puis 1er chargement
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) { window.location.replace('/auth/login'); return; }

      const { data: profile } = await supa
        .from('profiles')
        .select('role, full_name, level, university')
        .eq('id', user.id)
        .maybeSingle();

      const role = (profile?.role as any) ?? ((user.user_metadata as any)?.role ?? null);
      if (role === 'tutor') {
        window.location.replace('/dashboard/tutor');
        return;
      }

      setProfileInfo({
        full_name: profile?.full_name ?? (user.user_metadata as any)?.full_name ?? null,
        level: profile?.level ?? null,
        university: profile?.university ?? null,
      });

      await reloadData();
      setLoading(false);
    })();
  }, [supa, reloadData]);

  // ✅ Clé stable dérivée des IDs de demandes (évite l’expression complexe dans deps)
  const requestIdsKey = useMemo(() => {
    return requests.map(r => r.id).sort().join(',');
  }, [requests]);

  // ✅ Realtime : (matches + sessions) filtrés par request_id
  useEffect(() => {
    if (!studentId) return;

    // nettoie l'ancien channel
    if (channelRef.current) {
      supa.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ids = requests.map(r => r.id);
    if (!ids.length) return;

    // Supabase Realtime accepte in.(val1,val2) sans guillemets
    const filter = `request_id=in.(${ids.join(',')})`;

    const ch = supa
      .channel(`student-live-${ids[0]}`) // nom stable tant que le 1er id ne change pas
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter },
        () => debouncedReload()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter },
        () => debouncedReload()
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supa.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // ✅ deps simples et vérifiables par eslint
  }, [supa, studentId, debouncedReload, requestIdsKey, requests.length, requests]);

  const stats = useMemo(() => {
    const activeReq = requests.length;
    const scheduled = sessions.length;
    let tutorsFound = 0;
    matchesMap.forEach(arr => {
      tutorsFound += arr.filter(m => m.status === 'proposed' || m.status === 'accepted').length;
    });
    return { activeReq, scheduled, tutorsFound, avgRating: 0 };
  }, [requests, sessions, matchesMap]);

  const onChooseTutor = useCallback(async (matchId: UUID) => {
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setMinutes(0, 0, 0);

      const res = await fetch(`/api/matches/${matchId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: start.toISOString(), durationMin: 60 }),
      });
      const json = await (async () => { try { return await res.json(); } catch { return null; } })();
      if (!res.ok) throw new Error(json?.error || 'Erreur');
      await reloadData();
    } catch (e) {
      console.error(e);
    }
  }, [reloadData]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Chargement…</h1>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Topbar fullName={profileInfo.full_name || undefined} />

      <div className="container mx-auto px-4 py-8">
        {created && (
          <div className="mb-4 rounded-lg border bg-green-50 text-green-800 px-4 py-3">
            🎉 Votre demande a été publiée avec succès.
          </div>
        )}

        <div className="relative mb-6 rounded-2xl border bg-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-purple-50" />
          <div className="relative px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                {profileInfo.full_name || '—'}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {profileInfo.level || '—'}
                {profileInfo.university ? <span> • {profileInfo.university}</span> : null}
              </p>
            </div>
            <Link href="/request/new" prefetch>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Nouvelle demande
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Demandes actives</p>
                <p className="text-2xl font-bold">{stats.activeReq}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Sessions programmées</p>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Tuteurs trouvés</p>
                <p className="text-2xl font-bold">{stats.tutorsFound}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Note moyenne</p>
                <p className="text-2xl font-bold">{(0).toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests">Mes demandes</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Mes demandes de soutien</h2>
            </div>

            {requests.length === 0 ? (
              <Card><CardContent className="p-6 text-gray-600">Aucune demande.</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {requests.map((r) => {
                  const tuteursRaw = matchesMap.get(r.id) ?? [];
                  const tuteurs = tuteursRaw.filter(m => m.status === 'proposed' || m.status === 'accepted');

                  // Unifie slots depuis vue (slots_codes) ou table requests (slots)
                  const codes: string[] =
                    (Array.isArray(r.slots_codes) && r.slots_codes.length
                      ? r.slots_codes
                      : Array.isArray(r.slots) && r.slots.length
                        ? r.slots.map((s: any) => `${s.day}:${s.pod}`)
                        : []) as string[];

                  return (
                    <Card key={r.id}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{r.subject ?? '—'}</h3>
                            <p className="text-sm text-gray-600">
                              {modeLabel(r.mode)} • Créée le {r.created_at ? fmtDate(r.created_at) : '—'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                            {(r.tutors_found ?? tuteurs.length)} tuteur(s) trouvé(s)
                          </Badge>
                        </div>

                        {codes.length > 0 && (
                          <>
                            <p className="mt-4 text-sm font-medium">Créneaux de disponibilité :</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {codes.map((code, i) => (
                                <SlotPill key={`${r.id}-slot-${i}`} code={code} />
                              ))}
                            </div>
                          </>
                        )}

                        <p className="mt-5 text-sm font-medium">Tuteurs compatibles :</p>
                        <div className="mt-3 space-y-3">
                          {tuteurs.length === 0 ? (
                            <div className="text-gray-500 text-sm">Aucun tuteur pour le moment.</div>
                          ) : tuteurs.map((m) => (
                            <div key={m.match_id} className="border rounded-lg px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
                                  {initials(m.tutor.full_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{m.tutor.full_name ?? 'Tuteur'}</div>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {(m.tutor.subjects ?? []).slice(0, 3).map((sub, i) => (
                                      <span key={`${m.match_id}-sub-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                        {sub}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => onChooseTutor(m.match_id)}
                                  disabled={m.status === 'accepted'}
                                >
                                  {m.status === 'accepted' ? 'Déjà accepté' : 'Choisir ce tuteur'}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-6">
            {sessions.length === 0 ? (
              <Card><CardContent className="p-6 text-gray-600">Aucune session.</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {sessions.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Session #{s.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-600">
                            {s.starts_at ? fmtDate(s.starts_at) : 'à planifier'} • {modeLabel(s.mode)}
                          </p>
                        </div>
                      </div>
                      {s.jitsi_link && (
                        <Button size="sm" className="mt-3" asChild>
                          <a href={s.jitsi_link} target="_blank" rel="noreferrer">Rejoindre</a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
