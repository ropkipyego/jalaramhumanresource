-- Create IT department
INSERT INTO public.departments (code, name, description)
VALUES ('IT', 'IT Department', 'Information Technology and Systems Support')
ON CONFLICT (code) DO NOTHING;