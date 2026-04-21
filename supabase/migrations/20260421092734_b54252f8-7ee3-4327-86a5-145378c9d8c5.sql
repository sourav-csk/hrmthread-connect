
CREATE POLICY "Admins delete attendance"
ON public.attendance FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete leaves"
ON public.leaves FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete reimbursements"
ON public.reimbursements FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete payslips"
ON public.payslips FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
