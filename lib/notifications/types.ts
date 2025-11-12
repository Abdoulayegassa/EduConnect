export type AppNotification = {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, any>;
  created_at: string;
  read_at: string | null;
  delivered: boolean;
  meta: Record<string, any>;
};
