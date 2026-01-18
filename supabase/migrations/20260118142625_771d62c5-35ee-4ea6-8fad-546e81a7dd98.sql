-- Fix audit logs policy to be more restrictive
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create a function to insert audit logs (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.log_audit(
    _action TEXT,
    _table_name TEXT,
    _record_id UUID DEFAULT NULL,
    _old_data JSONB DEFAULT NULL,
    _new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), _action, _table_name, _record_id, _old_data, _new_data)
    RETURNING id INTO _log_id;
    
    RETURN _log_id;
END;
$$;