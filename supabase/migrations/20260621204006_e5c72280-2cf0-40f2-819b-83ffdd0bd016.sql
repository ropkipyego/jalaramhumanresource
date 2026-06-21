
-- 1) Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2) Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) App settings (for VAPID keys etc.)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'SUPER_ADMIN'::app_role));

-- 4) Trigger: notify employee when leave is approved / rejected
CREATE OR REPLACE FUNCTION public.notify_leave_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('approved','rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (
      NEW.employee_id,
      'leave_' || NEW.status,
      CASE WHEN NEW.status = 'approved' THEN 'Leave Approved' ELSE 'Leave Rejected' END,
      'Your leave from ' || to_char(NEW.start_date,'DD Mon') || ' to ' || to_char(NEW.end_date,'DD Mon YYYY') || ' has been ' || NEW.status || '.',
      '/my-leave',
      jsonb_build_object('leave_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_leave_status_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_leave_status
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_status_change();

-- 5) Trigger: notify department when a rota is published
CREATE OR REPLACE FUNCTION public.notify_rota_published()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dept_name TEXT;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    SELECT name INTO _dept_name FROM public.departments WHERE id = NEW.department_id;
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    SELECT ed.employee_id,
      'rota_published',
      'New Rota Published',
      COALESCE(_dept_name,'Department') || ' rota for week of ' || to_char(NEW.week_start,'DD Mon YYYY') || ' is now available.',
      '/my-rota',
      jsonb_build_object('rota_week_id', NEW.id, 'department_id', NEW.department_id)
    FROM public.employee_departments ed
    WHERE ed.department_id = NEW.department_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_rota_published() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_rota_published
  AFTER INSERT OR UPDATE ON public.rota_weeks
  FOR EACH ROW EXECUTE FUNCTION public.notify_rota_published();
