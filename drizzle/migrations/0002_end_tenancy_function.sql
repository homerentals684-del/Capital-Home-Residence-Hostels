CREATE OR REPLACE FUNCTION public.end_tenancy(_tenancy_id uuid, _note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare t public.tenancies; rm public.rooms;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Not authorized'; end if;
  select * into t from public.tenancies where id = _tenancy_id for update;
  if t.id is null then raise exception 'Tenancy not found'; end if;
  if t.status <> 'active' then raise exception 'Tenancy is not active'; end if;
  update public.tenancies set status = 'ended', ended_at = now() where id = t.id;
  update public.rooms set current_occupants = greatest(0, current_occupants - t.occupants),
    status = case when greatest(0, current_occupants - t.occupants) = 0 then 'vacant'::room_status else status end,
    updated_at = now() where id = t.room_id;
  insert into public.audit_log(actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'end_tenancy', 'tenancy', t.id::text, jsonb_build_object('user', t.user_id, 'note', _note));
end $$;
GRANT EXECUTE ON FUNCTION public.end_tenancy(uuid, text) TO authenticated;