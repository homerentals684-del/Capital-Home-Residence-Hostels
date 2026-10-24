import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
export function NotificationBell() {
  const { data: count } = useQuery({ queryKey: ['notifications-unread'], queryFn: async () => {
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    if (error) throw error;
    return count ?? 0;
  }, refetchInterval: 60_000 });
  return <Button asChild variant="ghost" size="sm"><Link to="/notifications" aria-label={`Notifications${count ? ` (${count} unread)` : ''}`} title="Notifications"><Bell />{Boolean(count) && <span className="rounded-full bg-gold px-1.5 text-xs text-gold-foreground">{count}</span>}</Link></Button>;
}
