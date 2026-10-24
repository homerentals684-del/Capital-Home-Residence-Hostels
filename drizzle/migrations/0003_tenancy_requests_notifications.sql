CREATE TABLE public.tenancy_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), tenancy_id uuid NOT NULL REFERENCES public.tenancies(id), kind text NOT NULL CHECK (kind IN ('move_out','next_semester')), semester_id uuid REFERENCES public.semesters(id), requested_date date, note text NOT NULL DEFAULT '' CHECK(length(note)<=1000), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')), admin_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 CHECK ((kind='move_out' AND requested_date IS NOT NULL AND semester_id IS NULL) OR (kind='next_semester' AND semester_id IS NOT NULL AND requested_date IS NULL))
);
GRANT SELECT ON public.tenancy_requests TO authenticated;
GRANT ALL ON public.tenancy_requests TO service_role;
ALTER TABLE public.tenancy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY requests_read ON public.tenancy_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX one_pending_request ON public.tenancy_requests(tenancy_id,kind) WHERE status='pending';
CREATE INDEX requests_user_created ON public.tenancy_requests(user_id,created_at DESC);
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), title text NOT NULL, message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE(read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX notifications_user_created ON public.notifications(user_id,created_at DESC);
CREATE FUNCTION public.submit_tenancy_request(_tenancy_id uuid, _kind text, _semester_id uuid DEFAULT NULL, _requested_date date DEFAULT NULL, _note text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenancies; s public.semesters; current_s public.semesters; rid uuid;
BEGIN
 SELECT * INTO t FROM public.tenancies WHERE id=_tenancy_id FOR UPDATE;
 IF auth.uid() IS NULL OR t.user_id IS DISTINCT FROM auth.uid() OR t.status<>'active' THEN RAISE EXCEPTION 'An active tenancy is required'; END IF;
 IF _kind='move_out' THEN
  IF _requested_date IS NULL OR _requested_date<current_date OR _semester_id IS NOT NULL THEN RAISE EXCEPTION 'Choose today or a future move-out date'; END IF;
 ELSIF _kind='next_semester' THEN
  SELECT * INTO s FROM public.semesters WHERE id=_semester_id;
  SELECT * INTO current_s FROM public.semesters WHERE id=t.semester_id;
  IF s.id IS NULL OR s.status='closed' OR s.start_date<=current_s.start_date OR _requested_date IS NOT NULL THEN RAISE EXCEPTION 'Choose a later open or upcoming semester'; END IF;
  IF EXISTS(SELECT 1 FROM public.rent_charges WHERE tenancy_id=t.id AND semester_id=s.id) THEN RAISE EXCEPTION 'This semester already has a rent charge'; END IF;
 ELSE RAISE EXCEPTION 'Invalid request type'; END IF;
 INSERT INTO public.tenancy_requests(user_id,tenancy_id,kind,semester_id,requested_date,note) VALUES(t.user_id,t.id,_kind,_semester_id,_requested_date,trim(coalesce(_note,''))) RETURNING id INTO rid;
 INSERT INTO public.notifications(user_id,title,message) SELECT user_id,'New tenancy request',coalesce((SELECT full_name FROM public.profiles WHERE id=t.user_id),'Tenant')||' submitted a '||replace(_kind,'_',' ')||' request.' FROM public.user_roles WHERE role='admin';
 RETURN rid;
END $$;
CREATE FUNCTION public.cancel_tenancy_request(_request_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.tenancy_requests SET status='cancelled',reviewed_at=now() WHERE id=_request_id AND user_id=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending request not found'; END IF;
END $$;
CREATE FUNCTION public.review_tenancy_request(_request_id uuid,_approve boolean,_note text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.tenancy_requests; t public.tenancies; s public.semesters; cs public.semesters; rm public.rooms;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO r FROM public.tenancy_requests WHERE id=_request_id FOR UPDATE;
 IF r.id IS NULL OR r.status<>'pending' THEN RAISE EXCEPTION 'Pending request not found'; END IF;
 IF NOT _approve AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'Add a rejection reason'; END IF;
 SELECT * INTO t FROM public.tenancies WHERE id=r.tenancy_id FOR UPDATE;
 IF _approve THEN
  IF t.status<>'active' THEN RAISE EXCEPTION 'Tenancy is no longer active'; END IF;
  IF r.kind='move_out' THEN
   IF r.requested_date>current_date THEN RAISE EXCEPTION 'Confirm move-out on or after the requested date'; END IF;
   PERFORM public.end_tenancy(t.id,coalesce(_note,''));
  ELSE
   SELECT * INTO s FROM public.semesters WHERE id=r.semester_id FOR UPDATE;
   SELECT * INTO cs FROM public.semesters WHERE id=t.semester_id;
   IF s.status='closed' OR s.start_date<=cs.start_date THEN RAISE EXCEPTION 'Semester is no longer eligible'; END IF;
   SELECT * INTO rm FROM public.rooms WHERE id=t.room_id FOR UPDATE;
   IF NOT rm.active OR rm.status='maintenance' THEN RAISE EXCEPTION 'Room is not available for renewal'; END IF;
   INSERT INTO public.rent_charges(tenancy_id,user_id,room_id,semester_id,amount_cents,due_date) VALUES(t.id,t.user_id,t.room_id,s.id,rm.semester_price_cents,s.rent_due_date);
   UPDATE public.tenancies SET semester_id=s.id WHERE id=t.id;
  END IF;
 END IF;
 UPDATE public.tenancy_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,admin_note=coalesce(_note,''),reviewed_at=now() WHERE id=r.id;
 INSERT INTO public.notifications(user_id,title,message) VALUES(r.user_id,CASE WHEN _approve THEN 'Request approved' ELSE 'Request rejected' END,replace(r.kind,'_',' ')||': '||CASE WHEN _approve THEN CASE WHEN r.kind='move_out' THEN 'Your tenancy has ended. Existing balances and receipts are retained.' ELSE 'Your semester has been renewed and a rent charge created.' END ELSE coalesce(_note,'') END);
 INSERT INTO public.audit_log(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'review_request','tenancy_request',r.id::text,jsonb_build_object('approved',_approve,'note',_note));
END $$;
REVOKE ALL ON FUNCTION public.submit_tenancy_request(uuid,text,uuid,date,text), public.cancel_tenancy_request(uuid), public.review_tenancy_request(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_tenancy_request(uuid,text,uuid,date,text), public.cancel_tenancy_request(uuid), public.review_tenancy_request(uuid,boolean,text) TO authenticated;
CREATE FUNCTION public.account_event_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='registrations' THEN
  IF TG_OP='INSERT' THEN
   INSERT INTO public.notifications(user_id,title,message) SELECT user_id,'New registration','A tenant application is awaiting review.' FROM public.user_roles WHERE role='admin';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO public.notifications(user_id,title,message) VALUES(NEW.user_id,'Registration '||NEW.status,'Your room application is '||NEW.status||'. '||coalesce(NEW.admin_note,''));
  END IF;
 ELSIF TG_TABLE_NAME='payments' THEN
  INSERT INTO public.notifications(user_id,title,message) VALUES(NEW.user_id,'Payment confirmed','Receipt '||NEW.receipt_number||' is available in Payments & Receipts.');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER registration_notifications AFTER INSERT OR UPDATE OF status ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.account_event_notification();
CREATE TRIGGER payment_notifications AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.account_event_notification();
COMMENT ON COLUMN public.profiles.location IS 'DEPRECATED: current location is no longer collected on registration';