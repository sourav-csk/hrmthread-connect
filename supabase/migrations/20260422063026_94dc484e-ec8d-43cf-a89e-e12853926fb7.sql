
-- Trigger function to adjust leave balance on approval/rejection
CREATE OR REPLACE FUNCTION public.adjust_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  days_count integer;
BEGIN
  days_count := (NEW.end_date - NEW.start_date) + 1;

  -- When status changes to approved, deduct balance (skip for unpaid)
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.leave_type != 'unpaid' THEN
    UPDATE public.employees
    SET leave_balance = GREATEST(leave_balance - days_count, 0)
    WHERE user_id = NEW.user_id;
  END IF;

  -- When an approved leave is rejected (reversed), restore balance
  IF NEW.status = 'rejected' AND OLD.status = 'approved' AND NEW.leave_type != 'unpaid' THEN
    UPDATE public.employees
    SET leave_balance = leave_balance + days_count
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_adjust_leave_balance
AFTER UPDATE ON public.leaves
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.adjust_leave_balance();

-- Admin delete policy for documents table
CREATE POLICY "Admins delete documents"
ON public.documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
