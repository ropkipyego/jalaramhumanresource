-- Create leave_entitlements table to track annual leave balances
CREATE TABLE public.leave_entitlements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    annual_days INTEGER NOT NULL DEFAULT 21,
    used_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (employee_id, year)
);

-- Enable RLS
ALTER TABLE public.leave_entitlements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own entitlements"
ON public.leave_entitlements
FOR SELECT
USING (employee_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]));

CREATE POLICY "Admin can manage entitlements"
ON public.leave_entitlements
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]));

-- Trigger for updated_at
CREATE TRIGGER update_leave_entitlements_updated_at
    BEFORE UPDATE ON public.leave_entitlements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get leave entitlement for current year (creates if not exists)
CREATE OR REPLACE FUNCTION public.get_or_create_leave_entitlement(_employee_id UUID, _year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS public.leave_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _entitlement leave_entitlements;
BEGIN
    -- Try to get existing entitlement
    SELECT * INTO _entitlement
    FROM public.leave_entitlements
    WHERE employee_id = _employee_id AND year = _year;
    
    -- Create if not exists
    IF NOT FOUND THEN
        INSERT INTO public.leave_entitlements (employee_id, year, annual_days, used_days)
        VALUES (_employee_id, _year, 21, 0)
        RETURNING * INTO _entitlement;
    END IF;
    
    RETURN _entitlement;
END;
$$;

-- Function to calculate used leave days (excluding maternity which is unlimited)
CREATE OR REPLACE FUNCTION public.calculate_used_leave_days(_employee_id UUID, _year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(
        (end_date - start_date + 1)::INTEGER
    ), 0)::INTEGER
    FROM public.leave_requests
    WHERE employee_id = _employee_id
      AND status = 'approved'
      AND leave_type != 'maternity'
      AND EXTRACT(YEAR FROM start_date) = _year;
$$;

-- Function to update used days when leave is approved
CREATE OR REPLACE FUNCTION public.update_leave_entitlement_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _year INTEGER;
    _used_days INTEGER;
BEGIN
    -- Only process when status changes to approved
    IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
        _year := EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
        
        -- Ensure entitlement exists
        PERFORM get_or_create_leave_entitlement(NEW.employee_id, _year);
        
        -- Calculate new used days
        _used_days := calculate_used_leave_days(NEW.employee_id, _year);
        
        -- Update entitlement
        UPDATE public.leave_entitlements
        SET used_days = _used_days, updated_at = now()
        WHERE employee_id = NEW.employee_id AND year = _year;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger to update entitlements when leave is approved
CREATE TRIGGER update_entitlement_on_leave_approval
    AFTER UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_leave_entitlement_on_approval();