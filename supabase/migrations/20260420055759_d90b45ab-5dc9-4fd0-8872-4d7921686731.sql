-- ===== ROLES =====
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== UPDATED-AT HELPER =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== EMPLOYEES (profile) =====
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  designation TEXT,
  date_of_joining DATE,
  avatar_url TEXT,
  face_descriptor JSONB,
  leave_balance INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Employees view own profile" ON public.employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all employees" ON public.employees FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Employees update own profile" ON public.employees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== AUTO-CREATE EMPLOYEE + DEFAULT ROLE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.employees (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== ATTENDANCE =====
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_in_selfie_url TEXT,
  check_out_selfie_url TEXT,
  face_match_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'present',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own attendance" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);

-- ===== LEAVES =====
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.leave_type AS ENUM ('casual', 'sick', 'earned', 'unpaid');

CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type leave_type NOT NULL DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View own leaves" ON public.leaves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all leaves" ON public.leaves FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own leaves" ON public.leaves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own pending leaves" ON public.leaves FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins update leaves" ON public.leaves FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ===== PAYSLIPS =====
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  gross_salary NUMERIC,
  net_salary NUMERIC,
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own payslips" ON public.payslips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage payslips" ON public.payslips FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== DOCUMENTS / NEWS =====
CREATE TYPE public.doc_type AS ENUM ('document', 'news');

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type doc_type NOT NULL DEFAULT 'document',
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated view documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== REIMBURSEMENTS =====
CREATE TYPE public.reimb_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

CREATE TABLE public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  receipt_url TEXT,
  status reimb_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_reimb_updated BEFORE UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "View own reimbursements" ON public.reimbursements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all reimbursements" ON public.reimbursements FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own reimbursements" ON public.reimbursements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own pending reimbursements" ON public.reimbursements FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins update reimbursements" ON public.reimbursements FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ===== ORG SETTINGS (geo-fence) =====
CREATE TABLE public.org_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  office_name TEXT DEFAULT 'Head Office',
  office_lat DOUBLE PRECISION,
  office_lng DOUBLE PRECISION,
  geofence_radius_m INTEGER DEFAULT 200,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_org_settings_updated BEFORE UPDATE ON public.org_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "All authenticated view org settings" ON public.org_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage org settings" ON public.org_settings FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.org_settings (id) VALUES (1);

-- ===== STORAGE BUCKETS =====
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('selfies', 'selfies', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('payslips', 'payslips', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Avatars (public)
CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Selfies (private — own folder)
CREATE POLICY "View own selfies" ON storage.objects FOR SELECT USING (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins view all selfies" ON storage.objects FOR SELECT USING (bucket_id = 'selfies' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Upload own selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Payslips (private — own folder, admin upload)
CREATE POLICY "View own payslips file" ON storage.objects FOR SELECT USING (bucket_id = 'payslips' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins manage payslip files" ON storage.objects FOR ALL USING (bucket_id = 'payslips' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'payslips' AND public.has_role(auth.uid(), 'admin'));

-- Documents (all auth view, admin upload)
CREATE POLICY "Auth view documents files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Admins manage documents files" ON storage.objects FOR ALL USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

-- Receipts (own folder)
CREATE POLICY "View own receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins view all receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Upload own receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);