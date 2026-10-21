create type public.attempt_status as enum ('pending','success','failed','unmatched');

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null,
  rent_charge_id uuid not null references public.rent_charges(id),
  amount_cents bigint not null check (amount_cents > 0),
  phone text not null,
  status attempt_status not null default 'pending',
  provider_status text,
  display_text text,
  provider_message text,
  paystack_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payment_attempts(rent_charge_id, status);
create index on public.payment_attempts(user_id);
grant select on public.payment_attempts to authenticated;
grant all on public.payment_attempts to service_role;
alter table public.payment_attempts enable row level security;
create policy "own or admin attempts" on public.payment_attempts for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create sequence public.receipt_seq;
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.payment_attempts(id),
  rent_charge_id uuid not null references public.rent_charges(id),
  user_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  balance_after_cents bigint not null,
  receipt_number text not null unique default ('CHR-RCT-' || lpad(nextval('public.receipt_seq')::text, 6, '0')),
  paystack_reference text not null unique,
  method text not null default 'M-Pesa (Paystack)',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.payments(user_id);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own or admin payments" on public.payments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.finalize_payment(_reference text, _amount_cents bigint, _currency text, _paystack_id bigint, _paid_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare a public.payment_attempts; c public.rent_charges; newpaid bigint;
begin
  select * into a from public.payment_attempts where reference = _reference for update;
  if a.id is null then return 'unknown_reference'; end if;
  if a.status = 'success' then return 'already_processed'; end if;
  if upper(_currency) <> 'KES' or _amount_cents <> a.amount_cents then
    update public.payment_attempts set status = 'unmatched', provider_message = 'Amount/currency mismatch', paystack_id = _paystack_id, updated_at = now() where id = a.id;
    insert into public.audit_log(action, entity, entity_id, details) values ('payment_unmatched','payment_attempt',a.id::text, jsonb_build_object('amount',_amount_cents,'currency',_currency));
    return 'unmatched';
  end if;
  select * into c from public.rent_charges where id = a.rent_charge_id for update;
  newpaid := c.paid_cents + _amount_cents;
  if newpaid > c.amount_cents then
    update public.payment_attempts set status = 'unmatched', provider_message = 'Would overpay charge', paystack_id = _paystack_id, updated_at = now() where id = a.id;
    insert into public.audit_log(action, entity, entity_id, details) values ('payment_overpay','payment_attempt',a.id::text, jsonb_build_object('amount',_amount_cents));
    return 'unmatched';
  end if;
  insert into public.payments(attempt_id, rent_charge_id, user_id, amount_cents, balance_after_cents, paystack_reference, paid_at)
    values (a.id, c.id, a.user_id, _amount_cents, c.amount_cents - newpaid, _reference, coalesce(_paid_at, now()));
  update public.rent_charges set paid_cents = newpaid,
    status = case when newpaid >= amount_cents then 'paid'::charge_status else 'partially_paid'::charge_status end where id = c.id;
  update public.payment_attempts set status = 'success', provider_status = 'success', paystack_id = _paystack_id, updated_at = now() where id = a.id;
  insert into public.audit_log(action, entity, entity_id, details) values ('payment_success','payment',a.reference, jsonb_build_object('amount',_amount_cents));
  return 'success';
end $$;
revoke execute on function public.finalize_payment(text, bigint, text, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_payment(text, bigint, text, bigint, timestamptz) to service_role;