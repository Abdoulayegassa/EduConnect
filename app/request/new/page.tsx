"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DAYS, PODS, DAY_LABEL, POD_LABEL, keyFor, Mode, nextDateForDayPod, toDatetimeLocal } from "@/lib/matching/constants";
import type { Day, Pod } from "@/lib/matching/constants";
import type { InstantTutor } from "@/lib/matching/types";
import { useInstantMatch } from "@/hooks/useInstantMatch";
import { useToast } from "@/hooks/use-toast";

type SubjectRow = { id: number; name: string; slug: string };

const normSlug = (s: string) =>
  (s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function NewRequestPage() {
  const supa = supabaseBrowser();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectSlug, setSubjectSlug] = useState<string>("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");

  // Step 2
  const [mode, setMode] = useState<Mode>("visio");
  const [duration, setDuration] = useState("");

  // Step 3
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  // Subjects loading
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsErr, setSubjectsErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setSubjectsLoading(true);
        setSubjectsErr(null);
        const res = await fetch("/api/subjects");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();

        const raw: SubjectRow[] = (j?.subjects || []).map((s: any) => ({
          id: Number(s.id),
          name: String(s.name || "").trim(),
          slug: s.slug ? String(s.slug) : normSlug(String(s.name || "")),
        }));

        const bySlug = new Map<string, SubjectRow>();
        for (const s of raw) {
          const slug = s.slug || normSlug(s.name);
          if (!bySlug.has(slug)) bySlug.set(slug, { ...s, slug });
        }
        const dedup = Array.from(bySlug.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "fr", { sensitivity: "base" })
        );

        setSubjects(dedup);
        if (!subjectSlug && dedup.length) setSubjectSlug(dedup[0].slug);
      } catch (e: any) {
        setSubjectsErr(e?.message ?? "Impossible de charger les matières.");
      } finally {
        setSubjectsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.slug === subjectSlug) || null,
    [subjects, subjectSlug]
  );
  // (4) Fallback robuste si la liste est vide / pas encore chargée
  const subjectName = selectedSubject?.name ?? (subjectSlug ? subjectSlug.replace(/-/g, " ") : "");

  const canGoNext = (): boolean => {
    if (step === 1) return !!subjectName;
    if (step === 2) return !!mode;
    if (step === 3) return selectedSlots.length > 0;
    return true;
  };

  const structuredSlots = useMemo(() => {
    return selectedSlots.map((k) => {
      const [day, pod] = k.split(":") as [Day, Pod];
      return { day, pod };
    });
  }, [selectedSlots]);

  // ====== LIVE MATCH unifié (hook) ======
  // (5) Eviter les requêtes si aucun sujet choisi
  const { loading: mLoading, data: mTutors } = useInstantMatch(
    subjectName ? { subject: subjectName, mode, slotCodes: selectedSlots } : { subject: "", mode, slotCodes: [] }
  );

  // Quick create request → pour la réservation
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  // (2) Anti double-clic / double insert
  const creatingRef = useRef(false);

  async function quickCreateRequest(): Promise<string> {
    if (createdRequestId) return createdRequestId;
    if (creatingRef.current) {
      await new Promise((r) => setTimeout(r, 150));
      if (createdRequestId) return createdRequestId;
    }
    creatingRef.current = true;
    try {
      const payload = {
        subject: subjectName,
        mode,
        slots: structuredSlots,
        timeSlots: selectedSlots,
        request_meta: {
          description: description || undefined,
          goals: goals || undefined,
          duration: duration || undefined,
        },
      };
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erreur API");
      const reqId = j?.request?.id;
      if (!reqId) throw new Error("Aucun id de request retourné");
      setCreatedRequestId(reqId);
      return reqId;
    } finally {
      creatingRef.current = false;
    }
  }

  // ========= Modal de réservation =========
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTutor, setModalTutor] = useState<InstantTutor | null>(null);
  const [modalStartsAt, setModalStartsAt] = useState<string>("");
  const [modalDuration, setModalDuration] = useState<string>("60");

  function openReserveModal(tutor: InstantTutor) {
    // (3) Obliger un créneau sélectionné pour cohérence UX
    if (!selectedSlots.length) {
      setErr("Sélectionne au moins un créneau avant de réserver.");
      return;
    }
    setErr(null);
    setModalTutor(tutor);

    // suggestion: à partir du 1er selectedSlot sinon maintenant+1h
    let suggested = new Date();
    if (selectedSlots[0]) {
      const [d, p] = selectedSlots[0].split(":") as [Day, Pod];
      suggested = nextDateForDayPod(d, p);
    } else {
      suggested = new Date(Date.now() + 60 * 60 * 1000);
      suggested.setSeconds(0, 0);
    }
    setModalStartsAt(toDatetimeLocal(suggested));
    setModalDuration("60");
    setModalOpen(true);
  }

  async function confirmReservation() {
  if (!modalTutor) return;
  try {
    setLoading(true);
    setErr(null);

    // Auth guard
    const { data: { user } } = await supa.auth.getUser();
    if (!user) { router.replace("/auth/login"); return; }

    // Crée la request si pas déjà créée via quickCreateRequest()
    const reqId = createdRequestId ?? (await quickCreateRequest());

    // Normalisation des champs horaires
    const startsAtISO = new Date(modalStartsAt).toISOString();
    const durationMin = Math.max(30, parseInt(modalDuration || "60", 10) || 60);

    // Appel API — remplace les UUID hardcodés par les VRAIES valeurs
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: reqId,
        tutorId:   modalTutor.id,
        startsAt:  startsAtISO,
        durationMin
      })
    });

    const payload = await (async () => { try { return await res.json(); } catch { return null; } })();
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || "Reservation API error");
    }

    // Lecture des infos renvoyées par l'API
    const jitsi = payload?.session?.jitsiLink || payload?.session?.jitsi_link || null;
    const when  = payload?.session?.startsAt   || payload?.session?.starts_at || startsAtISO;

    // ✅ Toast de succès
    toast({
      title: "Réservation confirmée",
      description: jitsi
        ? "Ta session est programmée. Tu peux rejoindre la salle dès maintenant."
        : "Ta session est programmée. Le lien de salle sera disponible dans ton tableau de bord.",
      action: jitsi ? (
        // @ts-ignore — si tu as un ToastAction sinon remplace par un simple lien sous la description
        <a
          href={jitsi}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-1.5 text-white text-sm"
        >
          Rejoindre
        </a>
      ) : undefined,
    });

    // Ferme la modal et redirige
    setModalOpen(false);
    router.replace("/dashboard/student?created=1");
  } catch (e: any) {
    console.error(e);
    setErr(e?.message ?? "Réservation impossible.");
    // Optionnel: toast d’erreur
    toast?.({
      title: "Erreur",
      description: e?.message ?? "Réservation impossible.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
}


  async function handleSubmit() {
    setErr(null);
    setLoading(true);
    try {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) { router.replace("/auth/login"); return; }

      const payload = {
        subject: subjectName,
        mode,
        slots: structuredSlots,
        timeSlots: selectedSlots,
        request_meta: {
          description: description || undefined,
          goals: goals || undefined,
          duration: duration || undefined,
        },
      };

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await (async () => { try { return await res.json(); } catch { return {}; } })();
      if (!res.ok) throw new Error((j as any)?.error || "Erreur API");

      router.replace("/dashboard/student?created=1");
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de créer la demande.");
    } finally {
      setLoading(false);
    }
  }

  // (1) bouton Confirm disabled condition
  const canConfirm = !!modalTutor && !!modalStartsAt && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* topbar */}
      <div className="border-b bg-white/70 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <Link href="/dashboard/student" className="text-sm text-gray-600 hover:underline">
            ← Retour au tableau de bord
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Nouvelle demande de soutien</h1>
          <p className="text-gray-600 mt-1">Décrivez vos besoins et nous trouverons le tuteur parfait</p>

          {/* steps */}
          <div className="flex items-center justify-center gap-6 mt-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${n <= step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {n}
                </div>
                {n < 3 && <div className={`w-12 h-1 mx-3 ${n < step ? "bg-blue-600" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-600 mt-2">Étape {step} sur 3</div>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            {step === 1 && (<><CardTitle>Matière et niveau</CardTitle><CardDescription>Sélectionnez la matière et décrivez brièvement votre besoin</CardDescription></>)}
            {step === 2 && (<><CardTitle>Format et planning</CardTitle><CardDescription>Choisissez comment vous souhaitez recevoir les cours</CardDescription></>)}
            {step === 3 && (<><CardTitle>Disponibilités</CardTitle><CardDescription>Indiquez vos créneaux disponibles</CardDescription></>)}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div>
                  <Label>Matière *</Label>
                  <Select
                    value={subjectSlug}
                    onValueChange={setSubjectSlug}
                    disabled={subjectsLoading || (!!subjectsErr && subjects.length === 0)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={subjectsLoading ? "Chargement…" : subjectsErr ? "Réessayer" : "Sélectionnez une matière"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subjectsErr && <p className="text-xs text-red-600 mt-2">{subjectsErr}</p>}
                </div>

                <div>
                  <Label>Description du besoin</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2"
                    placeholder="Décrivez vos difficultés…"
                  />
                </div>

                <div>
                  <Label>Objectifs</Label>
                  <Input
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    className="mt-2"
                    placeholder="Préparer un examen, améliorer les notes…"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!canGoNext()} className="bg-blue-600 hover:bg-blue-700">
                    Continuer
                  </Button>
                </div>
              </>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <>
                <div>
                  <Label>Mode de cours *</Label>
                  <div className="grid md:grid-cols-3 gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => setMode("visio")}
                      className={`border rounded-lg p-4 text-left ${mode === "visio" ? "border-blue-600 bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <div className="font-medium">Visioconférence</div>
                      <div className="text-sm text-gray-600">Cours en ligne</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("presentiel")}
                      className={`border rounded-lg p-4 text-left ${mode === "presentiel" ? "border-blue-600 bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <div className="font-medium">Présentiel</div>
                      <div className="text-sm text-gray-600">Rencontre en personne</div>
                    </button>
                  </div>
                </div>

                <div>
                  <Label>Durée d’une session (indicatif)</Label>
                  <Input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-2"
                    placeholder="Ex: 1h, 1h30"
                  />
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
                  <Button onClick={() => setStep(3)} disabled={!canGoNext()} className="bg-blue-600 hover:bg-blue-700">
                    Continuer
                  </Button>
                </div>
              </>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <>
                <div>
                  <Label>Créneaux *</Label>
                  <p className="text-sm text-gray-600 mt-1 mb-3">
                    Sélectionnez vos créneaux — <b>{selectedSlots.length}</b> sélectionné(s)
                  </p>

                  <div className="overflow-x-auto rounded-lg border bg-white">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-3 text-left font-medium text-gray-600">Tranche / Jour</th>
                          {DAYS.map((d) => (
                            <th key={d} className="p-3 text-center font-medium text-gray-600">
                              {DAY_LABEL[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PODS.map((p) => (
                          <tr key={p} className="border-t">
                            <td className="p-3 font-medium text-gray-700">{POD_LABEL[p]}</td>
                            {DAYS.map((d) => {
                              const k = keyFor(d, p);
                              const checked = selectedSlots.includes(k);
                              return (
                                <td key={k} className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSlots((prev) =>
                                        prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
                                      )
                                    }
                                    className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition ${checked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                                    aria-pressed={checked}
                                  >
                                    {checked ? "✓" : ""}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button variant="outline" onClick={() => setSelectedSlots([])}>Vider</Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSelectedSlots((prev) => {
                          const add = DAYS.map((d) => keyFor(d, "evening" as Pod));
                          return Array.from(new Set([...prev, ...add]));
                        })
                      }
                    >
                      Tous les soirs
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSelectedSlots((prev) => {
                          const weekNights = (["mon","tue","wed","thu","fri"] as Day[]).map((d)=>keyFor(d,"evening"));
                          return Array.from(new Set([...prev, ...weekNights]));
                        })
                      }
                    >
                      Soirs (Lun→Ven)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSelectedSlots((prev) => {
                          const weekend = (["sat", "sun"] as Day[]).flatMap((d) =>
                            (["morning", "afternoon", "evening"] as Pod[]).map((p) => keyFor(d, p))
                          );
                          return Array.from(new Set([...prev, ...weekend]));
                        })
                      }
                    >
                      Week-end
                    </Button>
                  </div>
                </div>

                {/* LIVE MATCH PANEL */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">Tuteurs compatibles (live)</div>
                    {mLoading && <div className="text-xs text-gray-500">Recherche…</div>}
                  </div>

                  {!mLoading && mTutors.length === 0 && subjectName && (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                      Aucun tuteur trouvé pour ces critères.
                    </div>
                  )}

                  {mTutors.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mTutors.map((t) => (
                        <div key={t.id} className="border rounded-xl p-4 bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                              <Image
                                src={t.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(t.full_name || t.id)}`}
                                alt={t.full_name || "Tutor"}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{t.full_name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {(t.subjects || []).slice(0, 3).join(" • ")}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                Note {(t.rating ?? 0).toFixed(1)}★ · {t.reviews_count ?? 0} avis
                              </div>
                            </div>

                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => openReserveModal(t)}
                              disabled={loading}
                            >
                              Réserver
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recap */}
                <div className="border rounded-lg p-4 bg-blue-50 mt-6">
                  <div className="font-medium mb-1">Récapitulatif de votre demande</div>
                  <p className="text-sm text-gray-700">Matière : <b>{subjectName || "—"}</b></p>
                  <p className="text-sm text-gray-700">Mode : <b>{mode || "—"}</b></p>
                  <p className="text-sm text-gray-700">Créneaux : <b>{selectedSlots.length}</b> sélectionné(s)</p>
                </div>

                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
                  {/* (6) a11y aria-busy */}
                  <Button onClick={handleSubmit} disabled={!canGoNext() || loading} aria-busy={loading} className="bg-green-600 hover:bg-green-700">
                    {loading ? "Publication…" : "Publier ma demande"}
                  </Button>
                </div>

                {err && <p className="text-red-600 text-sm">{err}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========= Modal ========= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir l’horaire exact</DialogTitle>
            <DialogDescription>
              Confirme la date, l’heure et la durée avec {modalTutor?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Date & heure</Label>
              <Input
                type="datetime-local"
                value={modalStartsAt}
                onChange={(e) => setModalStartsAt(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Durée (minutes)</Label>
              <Select value={modalDuration} onValueChange={setModalDuration}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {[30, 45, 60, 75, 90, 120].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            {/* (1) + (6) */}
            <Button onClick={confirmReservation} disabled={!canConfirm} aria-busy={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? "Réservation…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
