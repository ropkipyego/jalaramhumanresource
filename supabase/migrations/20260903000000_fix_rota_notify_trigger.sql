-- Fix rota publish notification trigger (wrong column name week_start → week_start_date)
CREATE OR REPLACE FUNCTION public.notify_rota_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dept_name text;
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'published') THEN
    SELECT name INTO _dept_name FROM public.departments WHERE id = NEW.department_id;
    INSERT INTO public.notifications (user_id, type, title, body, link, data)
    SELECT ed.employee_id,
      'rota_published',
      'New Rota Published',
      COALESCE(_dept_name, 'Department') || ' rota for week of ' || to_char(NEW.week_start_date, 'DD Mon YYYY') || ' is now available.',
      '/my-rota',
      jsonb_build_object('rota_week_id', NEW.id, 'department_id', NEW.department_id)
    FROM public.employee_departments ed
    WHERE ed.department_id = NEW.department_id;
  END IF;
  RETURN NEW;
END;
$$;
