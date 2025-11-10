'use client';

import { fmtDate } from '@/lib/dates';
import Topbar from '@/components/dashboard/Topbar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Calendar, Star, Check } from 'lucide-react';

type MatchStatus = 'proposed' | 'accepted' | 'declined' | 'expired';

type MatchRow = {
  id: string;
  request_id: string;
  status: MatchStatus;
  created_at: string | null;
  request?: {
    subject: string | null;
    level: string | null;
    mode: 'visio' | 'presentiel' | null;
  } | null;
};

type SessionRow = {
  id: string;                 // uuid
  request_id: string | null;  // uuid
  jitsi_link: string | null;
  starts_at: string | null;
  created_at: string | null;
  match?: { id: string; status: MatchStatus } | null; // uuid
};

function useDebouncedCallback(cb: () => void, delay = 250) {
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => cb(), delay);
  }, [cb, delay]);
}

export default function TutorDashboard() {
  const supa = useMemo(() => supabaseBrowser(), []);

  const [activeTab, setActiveTab] = useState<'proposals' | 'sessions'>('proposals');
  const [loading, setLoading] = useState(true);

  const [profileInfo, setProfileInfo] = useState<{ full_name?: string | null; degree?: string | null }>({});
  const [proposed, setProposed] = useState<MatchRow[]>([]);
  const [accepted, setAccepted] = useState<MatchRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tutorId, setTutorId] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>['channel']> | null>(null);
  const badgeForStatus = (st: MatchStatus | string) => {
    if (st === 'accepted') return 'bg-green-100 text-green-800';
    if (st === 'proposed') return 'bg-yellow-100 text-yellow-800';
    if (st === 'declined') return 'bg-red-100 text-red-800';
    if (st === 'expired')  return 'bg-gray-200 text-gray-700';
    return 'bg-gray-100 text-gray-800';
  };

  const reloadData = useCallback(async () => {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return;
    setTutorId(user.id);

    const { data: mP } = await supa
      .from('matches')
      .select(`
        id, request_id, status, created_at,
        request:requests(subject, level, mode)
      `)
      .eq('tutor_id', user.id)
      .eq('status', 'proposed')
      .order('created_at', { ascending: false });
    setProposed((mP as any) ?? []);

    const { data: mA } = await supa
      .from('matches')
      .select(`
        id, request_id, status, created_at,
        request:requests(subject, level, mode)
      `)
      .eq('tutor_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });
    setAccepted((mA as any) ?? []);

    const { data: s } = await supa
      .from('sessions')
      .select(`
        id, request_id, jitsi_link, starts_at, created_at,
        match:matches!inner(id, status, tutor_id)
      `)
      .eq('match.tutor_id', user.id)
      .order('starts_at', { ascending: false });
    setSessions((s as any) ?? []);
  }, [supa]);

  // Recrée la version debounced après définition de reloadData
  const debouncedReloadFixed = useDebouncedCallback(reloadData, 250);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) { window.location.href = '/auth/login'; return; }

      const { data: profile } = await supa
        .from('profiles')
        .select('role, full_name, degree')
        .eq('id', user.id)
        .maybeSingle();

      const role: 'student' | 'tutor' | null =
        (profile?.role as any) ?? ((user.user_metadata as any)?.role ?? null);
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

  // Realtime ciblé sur les matches du tuteur + sessions liées
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
        () => debouncedReloadFixed()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        // On ne peut pas filtrer sessions par tutor_id directement sans vue ;
        // On recharge simplement (debounced), la requête sessions filtre déjà par match.tutor_id
        () => debouncedReloadFixed()
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supa.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supa, tutorId, debouncedReloadFixed]);

  const stats = useMemo(() => {
    const proposedCount = proposed.length;
    const acceptedCount = accepted.length;
    const scheduled = sessions.length;
    return { proposed: proposedCount, accepted: acceptedCount, scheduled, avgRating: 0 };
  }, [proposed, accepted, sessions]);

  // Le tuteur peut seulement DECLINER
  const onDecline = useCallback(async (matchId: string) => {
    setErr(null);
    setBusyMatchId(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = await (async () => { try { return await res.json(); } catch { return null; } })();
      if (!res.ok) throw new Error(payload?.error || `Erreur API (${res.status})`);

      setProposed(prev => prev.filter(m => m.id !== matchId));
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de décliner cette proposition.");
    } finally {
      setBusyMatchId(null);
    }
  }, []);

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
        <div className="relative mb-6 rounded-2xl border bg-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-purple-50" />
          <div className="relative px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              {profileInfo.full_name || '—'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{profileInfo.degree || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-4 flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Propositions reçues</p>
              <p className="text-2xl font-bold">{stats.proposed}</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4 flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Acceptées</p>
              <p className="text-2xl font-bold">{stats.accepted}</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4 flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sessions planifiées</p>
              <p className="text-2xl font-bold">{stats.scheduled}</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4 flex items-center">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Note moyenne</p>
              <p className="text-2xl font-bold">{(0).toFixed(1)}</p>
            </div>
          </CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="proposals">Propositions</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="proposals" className="mt-6">
            {proposed.length === 0 ? (
              <Card><CardContent className="p-6 text-gray-600">Aucune proposition pour le moment.</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {proposed.map((m) => (
                  <Card key={m.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{m.request?.subject ?? '—'}</CardTitle>
                          <CardDescription>
                            {m.request?.level ?? '—'} • {m.request?.mode ?? '—'}
                          </CardDescription>
                        </div>
                        <Badge className={badgeForStatus(m.status)}>{m.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDecline(m.id)}
                          disabled={busyMatchId === m.id}
                        >
                          {busyMatchId === m.id ? '…' : 'Décliner'}
                        </Button>
                        <Link
                          href={`/request/${m.request_id}`}
                          className="text-blue-600 hover:underline text-sm self-center"
                        >
                          Voir la demande
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                            {s.starts_at ? fmtDate(s.starts_at) : 'à planifier'}
                          </p>
                        </div>
                        <Badge className={badgeForStatus(s.match?.status ?? '')}>{s.match?.status ?? '—'}</Badge>
                      </div>
                      {s.jitsi_link && (
                        <Button size="sm" className="mt-3" asChild>
                          <a href={s.jitsi_link} target="_blank" rel="noreferrer">
                            Ouvrir la salle
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {err && <p className="text-red-600 text-sm mt-4">{err}</p>}
      </div>
    </div>
  );
}
