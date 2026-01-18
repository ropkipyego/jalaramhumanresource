-- Create invitations table to track pending staff invites
CREATE TABLE public.invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role app_role NOT NULL DEFAULT 'STAFF',
    department_id UUID REFERENCES public.departments(id),
    invited_by UUID REFERENCES auth.users(id),
    token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admin and Super Admin can view all invitations
CREATE POLICY "Admin can view invitations"
ON public.invitations
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]));

-- Admin and Super Admin can create invitations
CREATE POLICY "Admin can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]));

-- Admin and Super Admin can update invitations
CREATE POLICY "Admin can update invitations"
ON public.invitations
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]));

-- Admin and Super Admin can delete invitations
CREATE POLICY "Admin can delete invitations"
ON public.invitations
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['ADMIN'::app_role, 'SUPER_ADMIN'::app_role]));

-- Create index for faster lookups
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);