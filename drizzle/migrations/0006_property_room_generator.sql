ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_number_key;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_residence_room_number_key UNIQUE (residence_id, room_number);

CREATE OR REPLACE FUNCTION public.create_property_with_rooms(_name text, _location text, _room_numbers text[], _price_cents bigint, _max_occupancy integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'Property name required'; END IF;
  IF _room_numbers IS NULL OR array_length(_room_numbers,1) IS NULL THEN RAISE EXCEPTION 'No rooms to generate'; END IF;
  IF array_length(_room_numbers,1) > 500 THEN RAISE EXCEPTION 'At most 500 rooms at once'; END IF;
  IF _price_cents < 0 OR _max_occupancy < 1 THEN RAISE EXCEPTION 'Invalid rent or availability'; END IF;
  IF (SELECT count(DISTINCT n) FROM unnest(_room_numbers) n) <> array_length(_room_numbers,1) THEN RAISE EXCEPTION 'Duplicate room numbers in range'; END IF;
  INSERT INTO residences(name, location, default_price_cents) VALUES (trim(_name), coalesce(trim(_location),''), _price_cents) RETURNING id INTO _id;
  INSERT INTO rooms(residence_id, room_number, room_type, semester_price_cents, max_occupancy, status)
    SELECT _id, trim(n), CASE WHEN _max_occupancy = 1 THEN 'Single' ELSE 'Shared' END, _price_cents, _max_occupancy, 'vacant' FROM unnest(_room_numbers) n;
  INSERT INTO audit_log(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'create_property', 'residence', _id::text, jsonb_build_object('rooms', array_length(_room_numbers,1)));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_property_with_rooms(text,text,text[],bigint,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_property_with_rooms(text,text,text[],bigint,integer) TO authenticated;