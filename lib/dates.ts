export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Bamako' }) : '—';
