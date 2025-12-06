'use client';

import { fmtDate } from '@/lib/dates';
import Topbar from '@/components/dashboard/Topbar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Calendar, Star, Check } from 'lucide-react';
import { toast } from 'sonner';
import { FullPageLoader } from '@/components/FullPageLoader';


type MatchStatus = 'proposed' | 'accepted' | 'declined' | 'expired';

type MatchRow = {
  id: string;
  request_id: string;
  status: MatchStatus | string;
  created_at: string | null;
  request?: {
    subject: string | null;
    mode: 'visio' | 'presentiel' | null;
  } | null;
};

type SessionRow = {
  id: string;
  request_id: string | null;
  jitsi_link: string | null;
  starts_at: string | null;
  created_at: string | null;
  ends_at?: string | null;
  match?: { id: string; status: MatchStatus | string } | null;
};

function useDebouncedCallback(cb: () => void, delay = 250) {
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => cb(), delay);
  }, [cb, delay]);
}

const badgeForStatus = (st: MatchStatus | string) => {
  if (st === 'accepted') return 'bg-green-100 text-green-800';
  if (st === 'proposed') return 'bg-yellow-100 text-yellow-800';
  if (st === 'declined') return 'bg-red-100 text-red-800';
  if (st === 'expired') return 'bg-gray-200 text-gray-700';
  return 'bg-gray-100 text-gray-800';
};

const modeLabel = (m?: 'visio' | 'presentiel' | null) =>
  m === 'visio' ? 'Visioconférence' : m === 'presentiel' ? 'Présentiel' : '—';

export default function TutorDashboard() {
  const supa = useMemo(() => supabaseBrowser(), []);

  const [activeTab, setActiveTab] = useState<'proposals' | 'sessions'>('proposals');
  const [loading, setLoading] = useState(true);

  const [profileInfo, setProfileInfo] = useState<{
    full_name?: string | null;
    degree?: string | null;
    
  }>({});

  const [proposed, setProposed] = useState<MatchRow[]>([]);
  const [accepted, setAccepted] = useState<MatchRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
    const [avgRating, setAvgRating] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);


  const [tutorId, setTutorId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const reloadData = useCallback(async () => {
    

    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();

    if (authErr) {
      console.error('auth.getUser error', authErr);
    }

    if (!user) {
      return;
    }
    setTutorId(user.id);

    // 1) Récupérer tous les matches de ce tuteur (sans join ambigu)
    const { data: mAll, error: eAll } = await supa
      .from('matches')
      .select('id, request_id, status, created_at')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false });

    if (eAll) {
      console.error('matches SELECT error', eAll);
      setProposed([]);
      setAccepted([]);
    } else {
      const all = ((mAll ?? []) as any as MatchRow[]) ?? [];

      // 1.b) Charger les informations de demandes associées (subject, mode)
      const reqIds = Array.from(
        new Set(
          all
            .map((m) => m.request_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let requestsById = new Map<
        string,
        { subject: string | null; mode: 'visio' | 'presentiel' | null }
      >();

      if (reqIds.length > 0) {
        const { data: reqRows, error: eReq } = await supa
          .from('requests')
          .select('id, subject, mode')
          .in('id', reqIds);

        if (eReq) {
          console.error('requests SELECT (for matches) error', eReq);
        } else if (reqRows) {
          requestsById = new Map(
            reqRows.map((r: any) => [
              r.id as string,
              { subject: r.subject as string | null, mode: r.mode },
            ]),
          );
        }
      }

            const withRequest: MatchRow[] = all.map((m) => ({
        ...m,
        request: requestsById.get(m.request_id) ?? null,
      }));

      const onlyProposed = withRequest.filter((m) => m.status === 'proposed');
      const onlyAccepted = withRequest.filter((m) => m.status === 'accepted');

      setProposed(onlyProposed);
      setAccepted(onlyAccepted);
    }


    // 2) Sessions du tuteur (join clair matches → sessions)
    const { data: s, error: eSess } = await supa
      .from('sessions')
      .select(
        `
        id, request_id, jitsi_link, starts_at, created_at, ends_at,
        match:matches!inner(id, status, tutor_id)
      `,
      )
      .eq('match.tutor_id', user.id)
      .order('starts_at', { ascending: false });

    if (eSess) {
      console.error('sessions SELECT error', eSess);
      setSessions([]);
    } else {
      setSessions((s as any as SessionRow[]) ?? []);
    }
         let avg = 0;
    let count = 0;

    const { data: ratings, error: rErr } = await supa
      .from('session_ratings')
      .select('rating')
      .eq('tutor_id', user.id);

    if (!rErr && ratings && ratings.length > 0) {
      count = ratings.length;
      const sum = ratings.reduce(
        (acc: number, r: any) => acc + (r.rating ?? 0),
        0,
      );
      avg = sum / count;
    }

    setAvgRating(avg);
    setRatingsCount(count);

  }, [supa]);

  const debouncedReload = useDebouncedCallback(reloadData, 250);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supa.auth.getUser();
      if (!user) {
        window.location.href = '/auth/login';
        return;
      }

      const { data: profile } = await supa
        .from('profiles')
        .select('role, full_name, degree')
        .eq('id', user.id)
        .maybeSingle();

      const role: 'student' | 'tutor' | null =
        (profile?.role as any) ?? (user.user_metadata as any)?.role ?? null;

      if (role !== 'tutor') {
        window.location.replace('/dashboard/student');
        return;
      }

      setProfileInfo({
        full_name: profile?.full_name ?? (user.user_metadata as any)?.full_name ?? null,
        degree: profile?.degree ?? null,
   
      });

      await reloadData();
      setLoading(false);
    })();
  }, [supa, reloadData]);

  useEffect(() => {
    if (!tutorId) return;

    if (channelRef.current) {
      supa.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const filterMatches = `tutor_id=eq.${tutorId}`;

    const ch = supa
      .channel(`tutor-live-${tutorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: filterMatches },
        () => debouncedReload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => debouncedReload(),
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supa.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supa, tutorId, debouncedReload]);

  const stats = useMemo(() => {
    const proposedCount = proposed.length;
    const acceptedCount = accepted.length;
    const scheduled = sessions.length;
  
    return { proposed: proposedCount, accepted: acceptedCount, scheduled, avgRating  };
  }, [proposed, accepted, sessions, avgRating]);

const onDecline = useCallback(async (matchId: string) => {
  setErr(null);
  setBusyMatchId(matchId);
  try {
    const res = await fetch(`/api/matches/${matchId}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // ce n'est pas grave si le body est vide
      payload = null;
    }

    console.log('decline response', res.status, payload);

    // ✅ On ne regarde que le status HTTP
    if (!res.ok) {
      const msg =
        payload?.error || `Erreur API (${res.status}) pour le déclin`;
      toast.error(msg);  // ⬅️ ici
      throw new Error(msg);
    }

    // ✅ Succès : on enlève le match de la liste
    setProposed((prev) => prev.filter((m) => m.id !== matchId));
     toast.success('Proposition déclinée.'); // ✅ retour positif
  } catch (e: any) {
    console.error(e);
    setErr(e?.message ?? 'Impossible de décliner cette proposition.');
  } finally {
    setBusyMatchId(null);
  }
}, []);



 if (loading) {
  return <FullPageLoader />;
}


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Topbar fullName={profileInfo.full_name || undefined} />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

        {/* Header profil */}
        <div className="relative mb-6 rounded-2xl border bg-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-purple-50" />
          <div className="relative px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              {profileInfo.full_name || '—'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {profileInfo.degree || '—'}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Propositions reçues</p>
                <p className="text-2xl font-bold">{stats.proposed}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Acceptées</p>
                <p className="text-2xl font-bold">{stats.accepted}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Sessions planifiées</p>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
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
                <p className="text-2xl font-bold">
                  {ratingsCount > 0 ? stats.avgRating.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-500">
                  {ratingsCount > 0
                    ? `${ratingsCount} avis`
                    : 'Aucune note pour le moment'}
                </p>
              </div>

            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
         <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-grid">
  <TabsTrigger className="text-xs sm:text-sm" value="proposals">
    Propositions
  </TabsTrigger>
  <TabsTrigger className="text-xs sm:text-sm" value="sessions">
    Sessions
  </TabsTrigger>
</TabsList>


          {/* Propositions */}
          <TabsContent value="proposals" className="mt-6">
            {proposed.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-gray-600 text-sm">
                  Aucune proposition pour le moment. Tu seras notifié dès qu’un étudiant te choisit.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {proposed.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-semibold">
                            {m.request?.subject ?? `Demande #${m.request_id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-gray-600">
                            {modeLabel(m.request?.mode)} • Reçue le{' '}
                            {m.created_at ? fmtDate(m.created_at) : '—'}
                          </p>
                        </div>
                        <Badge className={badgeForStatus(m.status)}>{m.status}</Badge>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDecline(m.id)}
                          disabled={busyMatchId === m.id}
                        >
                          {busyMatchId === m.id ? '…' : 'Décliner'}
                        </Button>
                        {/* Si plus tard tu crées une page /request/[id], tu pourras remettre un lien ici */}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Sessions */}
          <TabsContent value="sessions" className="mt-6">
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-gray-600 text-sm">
                  Aucune session pour le moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {sessions.map((s) => {
                  const now = Date.now();
                  const startMs = s.starts_at ? new Date(s.starts_at).getTime() : null;
                  const endMs = s.ends_at
                    ? new Date(s.ends_at).getTime()
                    : startMs
                    ? startMs + 60 * 60 * 1000
                    : null;

                  const isFinished = !!endMs && endMs < now;

                  const effectiveStatus: MatchStatus | string = isFinished
                    ? 'expired'
                    : s.match?.status ?? 'accepted';

                  const statusLabel = isFinished ? 'terminée' : s.match?.status ?? 'programmée';
                  const badgeClass = badgeForStatus(effectiveStatus);

                  return (
                    <Card key={s.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              Session #{s.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {s.starts_at ? fmtDate(s.starts_at) : 'À planifier'}
                            </p>
                          </div>
                          <Badge className={badgeClass}>{statusLabel}</Badge>
                        </div>

                        {s.jitsi_link && !isFinished && (
                          <Button size="sm" className="mt-3" asChild>
                            <a
                              href={s.jitsi_link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ouvrir la salle
                            </a>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      </div>
    </div>
  );
}
