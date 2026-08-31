import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, Trash2, ExternalLink } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  deleteNotification,
  getUnreadCount, 
  listNotifications, 
  markAsRead, 
  markAllAsRead 
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const getCount = useServerFn(getUnreadCount);
  const getList = useServerFn(listNotifications);
  const markRead = useServerFn(markAsRead);
  const markAllRead = useServerFn(markAllAsRead);
  const removeNotification = useServerFn(deleteNotification);

  const [hasSession, setHasSession] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const safeCall = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      return await fn();
    } catch {
      // Sessão ausente/expirada: não quebra a UI.
      return null;
    }
  };

  const { data: countData } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => safeCall(() => getCount()),
    enabled: hasSession,
    retry: false,
    refetchInterval: 30000, // 30s
  });

  const { data: listData } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => safeCall(() => getList()),
    enabled: hasSession,
    retry: false,
  });

  const count = countData?.count ?? 0;
  const notifications = listData?.notifications ?? [];

  // Ouvir notificações em tempo real
  useEffect(() => {
    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markRead({ data: { id } });
      refreshNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await removeNotification({ data: { id } });
      refreshNotifications();
      toast.success("Notificação removida.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível remover a notificação.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      refreshNotifications();
      toast.success("Todas as notificações marcadas como lidas.");
    } catch (e) {
      toast.error("Erro ao marcar notificações.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden border-white/10 bg-background/95 backdrop-blur-xl">
        <DropdownMenuLabel className="flex items-center justify-between p-4 border-b border-white/5">
          <span className="font-bold text-sm uppercase tracking-tighter">Notificações</span>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold text-primary" onClick={handleMarkAllRead}>
              Limpas todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs">Tudo limpo por aqui.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => {
                const isRead = !!n.read_at;
                return (
                  <div 
                    key={n.id} 
                    className={cn(
                      "relative flex flex-col gap-1 p-4 border-b border-white/5 transition-colors hover:bg-white/5",
                      !isRead && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold leading-tight">
                        {n.emoji && <span className="mr-1">{n.emoji}</span>}
                        {n.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      {n.link && (
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold uppercase">
                          <Link to={n.link} onClick={() => !isRead && handleMarkRead(n.id)}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver
                          </Link>
                        </Button>
                      )}
                      {!isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-[10px] font-bold uppercase text-primary"
                          onClick={() => handleMarkRead(n.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Lida
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 px-2 text-[10px] font-bold uppercase text-red-300 hover:text-red-200"
                        disabled={deletingId === n.id}
                        onClick={() => handleDelete(n.id)}
                        title="Excluir notificação"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Excluir
                      </Button>
                    </div>
                    
                    {!isRead && (
                      <div className="absolute top-4 left-1 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2 text-center">
          <Button asChild variant="ghost" size="sm" className="w-full text-[10px] font-bold uppercase">
            <Link to="/painel">Ver todas no painel</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
