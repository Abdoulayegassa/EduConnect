"use client";
import { Bell } from "lucide-react";
import { useNotifications } from "@/components/NotificationsProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuItem
} from "@/components/ui/dropdown-menu";

export function NotificationsBell() {
  const { unread, all, markAsRead, markAllAsRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative">
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <Badge className="absolute -top-1 -right-1 text-[10px] px-1 py-0 h-4 rounded-full">
              {unread.length > 99 ? "99+" : unread.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unread.length === 0}>
            Tout marquer lu
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {all.length === 0 && <div className="p-3 text-sm text-gray-500">Aucune notification</div>}
        {all.slice(0, 10).map(n => (
          <DropdownMenuItem key={n.id} className="flex items-start gap-2">
            <div className={`mt-1 h-2 w-2 rounded-full ${n.read_at ? "bg-gray-300" : "bg-blue-600"}`} />
            <div className="flex-1">
              <div className="text-sm font-medium">{n.kind.replace(/_/g, " ")}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {n.payload?.message ?? JSON.stringify(n.payload)}
              </div>
              {!n.read_at && (
                <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={() => markAsRead(n.id)}>
                  Marquer comme lu
                </Button>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
