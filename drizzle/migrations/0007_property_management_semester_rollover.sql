ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS image_path text;

CREATE POLICY "property images public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'property-images');
CREATE POLICY "property images admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "property images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'property-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "property images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-images' AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.add_rooms_to_property(_residence_id uuid, _room_numbers text[], _price_cents bigint, _max_occupancy integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM residences WHERE id=_residence_id) THEN RAISE EXCEPTION 'Property not found'; END IF;
  IF _room_numbers IS NULL OR array_length(_room_numbers,1) IS NULL THEN RAISE EXCEPTION 'No rooms to add'; END IF;
  IF array_length(_room_numbers,1) > 500 THEN RAISE EXCEPTION 'At most 500 rooms at once'; END IF;
  IF _price_cents < 0 OR _max_occupancy < 1 THEN RAISE EXCEPTION 'Invalid rent or availability'; END IF;
  -- reactivate archived rooms in range
  UPDATE rooms SET active=true, updated_at=now() WHERE residence_id=_residence_id AND room_number = ANY(SELECT trim(x) FROM unnest(_room_numbers) x) AND NOT active;
  INSERT INTO rooms(residence_id, room_number, room_type, semester_price_cents, max_occupancy, status)
    SELECT DISTINCT _residence_id, trim(n), CASE WHEN _max_occupancy=1 THEN 'Single' ELSE 'Shared' END, _price_cents, _max_occupancy, 'vacant'::room_status FROM unnest(_room_numbers) n
    ON CONFLICT (residence_id, room_number) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO audit_log(actor_id, action, entity, entity_id, details) VALUES (auth.uid(),'add_rooms','residence',_residence_id::text, jsonb_build_object('added',_n));
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.delete_room(_room_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM tenancies WHERE room_id=_room_id AND status='active') THEN RAISE EXCEPTION 'Room has an active tenant. Remove the tenant first.'; END IF;
  IF EXISTS (SELECT 1 FROM tenancies WHERE room_id=_room_id) OR EXISTS (SELECT 1 FROM registrations WHERE room_id=_room_id) OR EXISTS (SELECT 1 FROM rent_charges WHERE room_id=_room_id) THEN
    UPDATE rooms SET active=false, updated_at=now() WHERE id=_room_id;
    UPDATE registrations SET status='rejected', admin_note='Room removed', reviewed_at=now() WHERE room_id=_room_id AND status='pending';
    INSERT INTO audit_log(actor_id, action, entity, entity_id) VALUES (auth.uid(),'archive_room','room',_room_id::text);
    RETURN 'archived';
  END IF;
  DELETE FROM room_notes WHERE room_id=_room_id;
  DELETE FROM rooms WHERE id=_room_id;
  INSERT INTO audit_log(actor_id, action, entity, entity_id) VALUES (auth.uid(),'delete_room','room',_room_id::text);
  RETURN 'deleted';
END $$;

CREATE OR REPLACE FUNCTION public.delete_property(_residence_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _archived boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM tenancies t JOIN rooms rm ON rm.id=t.room_id WHERE rm.residence_id=_residence_id AND t.status='active') THEN RAISE EXCEPTION 'Property has active tenants. Remove them first.'; END IF;
  FOR r IN SELECT id FROM rooms WHERE residence_id=_residence_id LOOP
    IF public.delete_room(r.id) = 'archived' THEN _archived := true; END IF;
  END LOOP;
  IF _archived OR EXISTS (SELECT 1 FROM registrations WHERE residence_id=_residence_id) THEN
    UPDATE residences SET active=false, updated_at=now() WHERE id=_residence_id;
    RETURN 'archived';
  END IF;
  DELETE FROM residences WHERE id=_residence_id;
  INSERT INTO audit_log(actor_id, action, entity, entity_id) VALUES (auth.uid(),'delete_property','residence',_residence_id::text);
  RETURN 'deleted';
END $$;

CREATE OR REPLACE FUNCTION public.delete_tenant(_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.has_role(_user_id,'admin') THEN RAISE EXCEPTION 'Cannot delete an administrator'; END IF;
  FOR t IN SELECT id FROM tenancies WHERE user_id=_user_id AND status='active' LOOP PERFORM public.end_tenancy(t.id,'Tenant deleted'); END LOOP;
  UPDATE registrations SET status='rejected', admin_note='Tenant removed', reviewed_at=now() WHERE user_id=_user_id AND status='pending';
  IF EXISTS (SELECT 1 FROM payments WHERE user_id=_user_id) OR EXISTS (SELECT 1 FROM payment_attempts WHERE user_id=_user_id) THEN
    INSERT INTO audit_log(actor_id, action, entity, entity_id) VALUES (auth.uid(),'archive_tenant','profile',_user_id::text);
    RETURN 'archived';
  END IF;
  DELETE FROM tenancy_requests WHERE user_id=_user_id;
  DELETE FROM rent_charges WHERE user_id=_user_id;
  DELETE FROM tenancies WHERE user_id=_user_id;
  DELETE FROM registrations WHERE user_id=_user_id;
  DELETE FROM notifications WHERE user_id=_user_id;
  UPDATE sms_messages SET recipient_user_id=NULL WHERE recipient_user_id=_user_id;
  DELETE FROM auth.users WHERE id=_user_id;
  INSERT INTO audit_log(actor_id, action, entity, entity_id) VALUES (auth.uid(),'delete_tenant','profile',_user_id::text);
  RETURN 'deleted';
END $$;

CREATE OR REPLACE FUNCTION public.start_semester(_semester_id uuid, _carry_over boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s semesters; t record; _new uuid; _price bigint; _n integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO s FROM semesters WHERE id=_semester_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Semester not found'; END IF;
  UPDATE semesters SET status='closed' WHERE status='open' AND id<>s.id AND start_date < s.start_date;
  UPDATE semesters SET status='open' WHERE id=s.id;
  FOR t IN SELECT * FROM tenancies WHERE status='active' AND semester_id<>s.id FOR UPDATE LOOP
    UPDATE tenancies SET status='ended', ended_at=now() WHERE id=t.id;
    IF _carry_over THEN
      SELECT semester_price_cents INTO _price FROM rooms WHERE id=t.room_id;
      INSERT INTO tenancies(user_id, room_id, semester_id, occupants) VALUES (t.user_id, t.room_id, s.id, t.occupants) RETURNING id INTO _new;
      INSERT INTO rent_charges(tenancy_id, user_id, room_id, semester_id, amount_cents, due_date) VALUES (_new, t.user_id, t.room_id, s.id, _price, s.rent_due_date);
      INSERT INTO notifications(user_id,title,message) VALUES (t.user_id,'New semester started', s.academic_year||' '||s.name||' has started. Your room was renewed and a new rent charge was created.');
    ELSE
      INSERT INTO notifications(user_id,title,message) VALUES (t.user_id,'Semester ended', 'A new semester ('||s.academic_year||' '||s.name||') has started. Register again to book a room. Your past records are kept.');
    END IF;
    _n := _n + 1;
  END LOOP;
  UPDATE rooms rm SET current_occupants = coalesce((SELECT sum(occupants) FROM tenancies x WHERE x.room_id=rm.id AND x.status='active'),0),
    status = CASE WHEN rm.status='maintenance' THEN rm.status WHEN coalesce((SELECT sum(occupants) FROM tenancies x WHERE x.room_id=rm.id AND x.status='active'),0) > 0 THEN 'occupied'::room_status ELSE 'vacant'::room_status END,
    updated_at = now();
  INSERT INTO audit_log(actor_id, action, entity, entity_id, details) VALUES (auth.uid(),'start_semester','semester',s.id::text, jsonb_build_object('tenancies',_n,'carry_over',_carry_over));
  RETURN _n;
END $$;