'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { applyServerSession, clearServerSession } from '@/app/actions/auth';

export default function SupabaseAuthSync() {
  const supa = supabaseBrowser();

  useEffect(() => {
    // Sync initial (si déjà connecté et tokens présents)
    supa.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s?.access_token && s?.refresh_token) {
        await applyServerSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        });
      }
    });

    const { data: { subscription } } = supa.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.access_token && session?.refresh_token) {
          // login / token refresh
          await applyServerSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        } else if (event === 'SIGNED_OUT') {
          // logout
          await clearServerSession();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supa]);

  return null;
}
