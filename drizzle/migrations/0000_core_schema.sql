create type public.app_role as enum ('admin','tenant');
create type public.room_status as enum ('available','occupied','vacant','maintenance');
create type public.registration_status as enum ('pending','approved','rejected');
create type public.tenancy_status as enum ('active','ended');
create type public.charge_status as enum ('unpaid','partially_paid','paid','overdue');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  location text not null default '',
  gender text not null default 'prefer_not_to_say',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.residences (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_price_cents bigint not null default 0 check (default_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.residences to anon;
grant select, insert, update, delete on public.residences to authenticated;
grant all on public.residences to service_role;
alter table public.residences enable row level security;
create policy "public read residences" on public.residences for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin manage residences" on public.residences for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict,
  room_number text not null unique,
  room_type text not null default 'Single',
  semester_price_cents bigint not null check (semester_price_cents >= 0),
  max_occupancy int not null default 1 check (max_occupancy >= 1),
  current_occupants int not null default 0 check (current_occupants >= 0),
  status room_status not null default 'available',
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.rooms(residence_id);
grant select on public.rooms to anon;
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "public read rooms" on public.rooms for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin manage rooms" on public.rooms for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.room_notes (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  maintenance_notes text not null default '',
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.room_notes to authenticated;
grant all on public.room_notes to service_role;
alter table public.room_notes enable row level security;
create policy "admin notes" on public.room_notes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  rent_due_date date not null,
  status text not null default 'open' check (status in ('open','closed','upcoming')),
  created_at timestamptz not null default now(),
  unique (academic_year, name)
);
grant select on public.semesters to anon;
grant select, insert, update, delete on public.semesters to authenticated;
grant all on public.semesters to service_role;
alter table public.semesters enable row level security;
create policy "public read semesters" on public.semesters for select to anon, authenticated using (true);
create policy "admin manage semesters" on public.semesters for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create sequence public.registration_ref_seq;
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('CHR-' || to_char(now(),'YY') || '-' || lpad(nextval('public.registration_ref_seq')::text, 5, '0')),
  user_id uuid not null,
  residence_id uuid not null references public.residences(id),
  room_id uuid not null references public.rooms(id),
  semester_id uuid not null references public.semesters(id),
  occupants int not null check (occupants >= 1),
  status registration_status not null default 'pending',
  admin_note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.registrations(user_id);
grant select, insert on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "own or admin read regs" on public.registrations for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "tenant create own reg" on public.registrations for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and admin_note = '');
create policy "admin update regs" on public.registrations for update to authenticated using (public.has_role(auth.uid(),'admin'));
grant update on public.registrations to authenticated;

create table public.tenancies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid not null references public.rooms(id),
  semester_id uuid not null references public.semesters(id),
  registration_id uuid references public.registrations(id),
  occupants int not null check (occupants >= 1),
  status tenancy_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index tenancies_one_active_per_user on public.tenancies(user_id) where status = 'active';
grant select on public.tenancies to authenticated;
grant all on public.tenancies to service_role;
alter table public.tenancies enable row level security;
create policy "own or admin tenancies" on public.tenancies for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('RC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  user_id uuid not null,
  room_id uuid not null references public.rooms(id),
  semester_id uuid not null references public.semesters(id),
  amount_cents bigint not null check (amount_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  due_date date not null,
  status charge_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  unique (tenancy_id, semester_id)
);
grant select on public.rent_charges to authenticated;
grant all on public.rent_charges to service_role;
alter table public.rent_charges enable row level security;
create policy "own or admin charges" on public.rent_charges for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin audit" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- signup trigger: profile + role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, location, gender)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'location',''),
    coalesce(new.raw_user_meta_data->>'gender','prefer_not_to_say'));
  if lower(new.email) = 'okindatechhub@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles(user_id, role) values (new.id, 'tenant') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- approve / reject
create or replace function public.approve_registration(_reg_id uuid, _room_id uuid default null, _note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.registrations; rm public.rooms; s public.semesters; t_id uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Not authorized'; end if;
  select * into r from public.registrations where id = _reg_id for update;
  if r.id is null then raise exception 'Registration not found'; end if;
  if r.status <> 'pending' then raise exception 'Registration already reviewed'; end if;
  select * into rm from public.rooms where id = coalesce(_room_id, r.room_id) for update;
  if rm.status = 'maintenance' or not rm.active then raise exception 'Room is not available'; end if;
  if rm.current_occupants + r.occupants > rm.max_occupancy then raise exception 'Room capacity exceeded (% of % used)', rm.current_occupants, rm.max_occupancy; end if;
  if exists (select 1 from public.tenancies where user_id = r.user_id and status = 'active') then raise exception 'Tenant already has an active tenancy'; end if;
  select * into s from public.semesters where id = r.semester_id;
  insert into public.tenancies(user_id, room_id, semester_id, registration_id, occupants)
    values (r.user_id, rm.id, r.semester_id, r.id, r.occupants) returning id into t_id;
  insert into public.rent_charges(tenancy_id, user_id, room_id, semester_id, amount_cents, due_date)
    values (t_id, r.user_id, rm.id, r.semester_id, rm.semester_price_cents, s.rent_due_date);
  update public.rooms set current_occupants = current_occupants + r.occupants, status = 'occupied', updated_at = now() where id = rm.id;
  update public.registrations set status = 'approved', room_id = rm.id, residence_id = rm.residence_id, admin_note = coalesce(_note,''), reviewed_at = now() where id = r.id;
  insert into public.audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), 'approve', 'registration', r.id::text, jsonb_build_object('room', rm.room_number));
  return t_id;
end $$;

create or replace function public.reject_registration(_reg_id uuid, _note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Not authorized'; end if;
  update public.registrations set status = 'rejected', admin_note = coalesce(_note,''), reviewed_at = now() where id = _reg_id and status = 'pending';
  if not found then raise exception 'Registration not pending'; end if;
  insert into public.audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), 'reject', 'registration', _reg_id::text, jsonb_build_object('note', _note));
end $$;
revoke execute on function public.approve_registration(uuid, uuid, text) from anon, public;
revoke execute on function public.reject_registration(uuid, text) from anon, public;
grant execute on function public.approve_registration(uuid, uuid, text) to authenticated;
grant execute on function public.reject_registration(uuid, text) to authenticated;

-- storage policies
create policy "avatar upload own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar read own or admin" on storage.objects for select to authenticated using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));

-- seed
insert into public.residences(name, default_price_cents) values
 ('Capital Home Residence', 1500000), ('Duka Moja', 1500000), ('Old Rooms', 1500000), ('New Block Wing', 2500000);
insert into public.rooms(residence_id, room_number, room_type, semester_price_cents, max_occupancy)
select id, 'Old Room-0' || g, 'Shared', 1500000, 2 from public.residences, generate_series(1,6) g where name = 'Old Rooms';
insert into public.rooms(residence_id, room_number, room_type, semester_price_cents, max_occupancy)
select id, 'New Wing-0' || g, 'Single', 2500000, 1 from public.residences, generate_series(1,6) g where name = 'New Block Wing';
insert into public.semesters(academic_year, name, start_date, end_date, rent_due_date, status) values
 ('2026/2027','Semester 1','2026-09-01','2026-12-18','2026-09-15','open'),
 ('2026/2027','Semester 2','2027-01-11','2027-04-30','2027-01-25','upcoming');