import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Users, CalendarDays, CheckCircle2, XCircle, Clock,
  Upload, FileText, Megaphone, IndianRupee, Search, LayoutDashboard,
  Receipt, TrendingUp, UserCog, Eye, ChevronDown, ChevronRight,
  Mail, Phone, Building2, Briefcase, Hash, Shield, Edit2, Save, Trash2
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

/* ─── Types ─── */
interface Employee {
  id: string; user_id: string; full_name: string; email: string;
  department: string | null; designation: string | null;
  employee_code: string | null; phone: string | null;
  date_of_joining: string | null; leave_balance: number;
  avatar_url: string | null;
}
interface LeaveReq {
  id: string; user_id: string; leave_type: string; start_date: string;
  end_date: string; reason: string; status: string;
  reviewer_notes: string | null; created_at: string;
}
interface ReimbReq {
  id: string; user_id: string; category: string; amount: number;
  expense_date: string; description: string | null; status: string;
  reviewer_notes: string | null; created_at: string; receipt_url: string | null;
}
interface AttRow {
  id: string; user_id: string; date: string; check_in_at: string | null;
  check_out_at: string | null; face_match_score: number | null; status: string;
}
interface UserRole {
  id: string; user_id: string; role: "admin" | "employee";
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AdminConsole() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveReq[]>([]);
  const [allReimbs, setAllReimbs] = useState<ReimbReq[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttRow[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [searchQ, setSearchQ] = useState("");

  // Payslip upload
  const [payOpen, setPayOpen] = useState(false);
  const [payUserId, setPayUserId] = useState("");
  const [payMonth, setPayMonth] = useState(String(new Date().getMonth() + 1));
  const [payYear, setPayYear] = useState(String(new Date().getFullYear()));
  const [payGross, setPayGross] = useState("");
  const [payNet, setPayNet] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  // News
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsDesc, setNewsDesc] = useState("");
  const [newsSubmitting, setNewsSubmitting] = useState(false);

  // Document
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docSubmitting, setDocSubmitting] = useState(false);

  // Leave filter
  const [leaveFilter, setLeaveFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reimbFilter, setReimbFilter] = useState<"pending" | "approved" | "rejected" | "paid" | "all">("pending");

  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    (async () => {
      const [{ data: e }, { data: l }, { data: r }, { data: a }, { data: ro }] = await Promise.all([
        supabase.from("employees").select("*").order("full_name"),
        supabase.from("leaves").select("*").order("created_at", { ascending: false }),
        supabase.from("reimbursements").select("*").order("created_at", { ascending: false }),
        supabase.from("attendance").select("*").eq("date", today).order("check_in_at", { ascending: true }),
        supabase.from("user_roles").select("*"),
      ]);
      setEmployees((e ?? []) as Employee[]);
      setAllLeaves((l ?? []) as LeaveReq[]);
      setAllReimbs((r ?? []) as ReimbReq[]);
      setTodayAttendance((a ?? []) as AttRow[]);
      setRoles((ro ?? []) as UserRole[]);
      setLoading(false);
    })();
  }, [user]);

  const empMap = useMemo(() => new Map(employees.map((e) => [e.user_id, e])), [employees]);
  const empName = (uid: string) => empMap.get(uid)?.full_name ?? "Unknown";
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.user_id, r.role])), [roles]);

  // Stats
  const pendingLeaves = allLeaves.filter((l) => l.status === "pending").length;
  const pendingReimbs = allReimbs.filter((r) => r.status === "pending").length;
  const checkedInToday = todayAttendance.filter((a) => a.check_in_at).length;
  const totalReimbAmt = allReimbs.filter((r) => r.status === "pending").reduce((s, x) => s + x.amount, 0);

  // Filtered
  const filteredLeaves = leaveFilter === "all" ? allLeaves : allLeaves.filter((l) => l.status === leaveFilter);
  const filteredReimbs = reimbFilter === "all" ? allReimbs : allReimbs.filter((r) => r.status === reimbFilter);
  const filteredEmps = employees.filter((e) =>
    e.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQ.toLowerCase()) ||
    (e.department ?? "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (e.employee_code ?? "").toLowerCase().includes(searchQ.toLowerCase())
  );

  /* ─── Actions ─── */
  const handleLeaveAction = async (id: string, action: "approved" | "rejected", notes: string) => {
    const { error } = await supabase.from("leaves").update({
      status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAllLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status: action, reviewer_notes: notes || null } : l));
    toast.success(`Leave ${action}`);
  };

  const handleReimbAction = async (id: string, action: "approved" | "rejected" | "paid", notes: string) => {
    const { error } = await supabase.from("reimbursements").update({
      status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAllReimbs((prev) => prev.map((r) => r.id === id ? { ...r, status: action, reviewer_notes: notes || null } : r));
    toast.success(`Claim ${action}`);
  };

  const changeRole = async (userId: string, newRole: "admin" | "employee") => {
    const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    setRoles((prev) => prev.map((r) => r.user_id === userId ? { ...r, role: newRole } : r));
    toast.success(`Role updated to ${newRole}`);
  };

  const updateEmployee = async (empId: string, updates: Partial<Employee>) => {
    const { error } = await supabase.from("employees").update(updates).eq("id", empId);
    if (error) { toast.error(error.message); return false; }
    setEmployees((prev) => prev.map((e) => e.id === empId ? { ...e, ...updates } : e));
    toast.success("Employee updated");
    return true;
  };

  const deleteEmployee = async (emp: Employee) => {
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("attendance").delete().eq("user_id", emp.user_id),
        supabase.from("leaves").delete().eq("user_id", emp.user_id),
        supabase.from("reimbursements").delete().eq("user_id", emp.user_id),
        supabase.from("payslips").delete().eq("user_id", emp.user_id),
        supabase.from("user_roles").delete().eq("user_id", emp.user_id),
      ]);
      const { error } = await supabase.from("employees").delete().eq("id", emp.id);
      if (error) throw error;
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      setRoles((prev) => prev.filter((r) => r.user_id !== emp.user_id));
      toast.success(`${emp.full_name} has been removed`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete employee");
    }
  };

  const uploadPayslip = async () => {
    if (!payUserId || !payFile) { toast.error("Select employee and upload PDF"); return; }
    setPaySubmitting(true);
    try {
      const path = `${payUserId}/${payYear}-${payMonth.padStart(2, "0")}.pdf`;
      const { error: upErr } = await supabase.storage.from("payslips").upload(path, payFile, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("payslips").insert({
        user_id: payUserId, month: parseInt(payMonth), year: parseInt(payYear),
        gross_salary: payGross ? parseFloat(payGross) : null,
        net_salary: payNet ? parseFloat(payNet) : null,
        file_path: path, uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success("Payslip uploaded");
      setPayOpen(false); setPayFile(null); setPayGross(""); setPayNet("");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    setPaySubmitting(false);
  };

  const postNews = async () => {
    if (!newsTitle.trim()) { toast.error("Title is required"); return; }
    setNewsSubmitting(true);
    const { error } = await supabase.from("documents").insert({
      title: newsTitle.trim(), description: newsDesc.trim() || null,
      doc_type: "news" as const, uploaded_by: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("News posted"); setNewsOpen(false); setNewsTitle(""); setNewsDesc(""); }
    setNewsSubmitting(false);
  };

  const uploadDocument = async () => {
    if (!docTitle.trim() || !docFile) { toast.error("Title and file are required"); return; }
    setDocSubmitting(true);
    try {
      const path = `company/${Date.now()}-${docFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, docFile, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        title: docTitle.trim(), description: docDesc.trim() || null,
        doc_type: "document" as const, file_path: path, uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success("Document uploaded");
      setDocOpen(false); setDocTitle(""); setDocDesc(""); setDocFile(null);
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    setDocSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-6 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl gradient-accent flex items-center justify-center shadow-glow">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-xs text-muted-foreground">Manage everything in one place</p>
        </div>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Total employees" value={employees.length} color="text-primary" />
        <StatCard icon={CalendarDays} label="Checked in today" value={`${checkedInToday}/${employees.length}`} color="text-primary" />
        <StatCard icon={Clock} label="Pending leaves" value={pendingLeaves} color="text-warning" onClick={() => { setTab("leaves"); setLeaveFilter("pending"); }} />
        <StatCard icon={IndianRupee} label="Pending claims" value={`₹${totalReimbAmt.toLocaleString("en-IN")}`} color="text-warning" onClick={() => { setTab("reimbs"); setReimbFilter("pending"); }} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 bg-secondary/60 h-auto">
          <TabsTrigger value="overview" className="text-[11px] py-2.5 flex-col gap-0.5">
            <LayoutDashboard className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="employees" className="text-[11px] py-2.5 flex-col gap-0.5">
            <Users className="h-3.5 w-3.5" /> Team
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-[11px] py-2.5 flex-col gap-0.5 relative">
            <CalendarDays className="h-3.5 w-3.5" /> Leaves
            {pendingLeaves > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-warning text-[9px] font-bold text-warning-foreground flex items-center justify-center">{pendingLeaves}</span>}
          </TabsTrigger>
          <TabsTrigger value="reimbs" className="text-[11px] py-2.5 flex-col gap-0.5 relative">
            <Receipt className="h-3.5 w-3.5" /> Claims
            {pendingReimbs > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-warning text-[9px] font-bold text-warning-foreground flex items-center justify-center">{pendingReimbs}</span>}
          </TabsTrigger>
          <TabsTrigger value="content" className="text-[11px] py-2.5 flex-col gap-0.5">
            <FileText className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
        </TabsList>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Today's attendance */}
          <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Today's Attendance
              </h3>
              <span className="text-xs text-muted-foreground">{format(new Date(), "d MMM yyyy")}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium">{checkedInToday} checked in</span>
              <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium">{employees.length - checkedInToday} absent</span>
            </div>
            {todayAttendance.length > 0 ? (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {todayAttendance.map((a) => {
                  const emp = empMap.get(a.user_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold">
                          {(emp?.full_name ?? "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <span className="text-xs font-medium">{emp?.full_name ?? "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{a.check_in_at ? format(parseISO(a.check_in_at), "HH:mm") : "--:--"}</span>
                        <span>→</span>
                        <span>{a.check_out_at ? format(parseISO(a.check_out_at), "HH:mm") : "—"}</span>
                        {a.face_match_score != null && (
                          <span className="text-primary flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3" />{(a.face_match_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">No check-ins yet today</p>
            )}
          </div>

          {/* Recent pending items */}
          {pendingLeaves > 0 && (
            <div className="rounded-2xl bg-card border border-warning/20 p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-warning">
                <Clock className="h-4 w-4" /> {pendingLeaves} leave request{pendingLeaves > 1 ? "s" : ""} pending
              </h3>
              <Button size="sm" variant="outline" onClick={() => { setTab("leaves"); setLeaveFilter("pending"); }}
                className="text-xs border-warning/30 text-warning hover:bg-warning/10">
                Review now <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {pendingReimbs > 0 && (
            <div className="rounded-2xl bg-card border border-warning/20 p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-warning">
                <IndianRupee className="h-4 w-4" /> {pendingReimbs} reimbursement{pendingReimbs > 1 ? "s" : ""} pending
              </h3>
              <Button size="sm" variant="outline" onClick={() => { setTab("reimbs"); setReimbFilter("pending"); }}
                className="text-xs border-warning/30 text-warning hover:bg-warning/10">
                Review now <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* Quick actions */}
          <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-2">
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-3 flex-col gap-1.5 border-border hover:border-primary/40 text-xs">
                    <IndianRupee className="h-4 w-4 text-primary" /> Upload Payslip
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Upload Payslip</DialogTitle>
                    <DialogDescription>Upload a salary slip PDF for an employee</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select value={payUserId} onValueChange={setPayUserId}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>{employees.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Select value={payMonth} onValueChange={setPayMonth}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" value={payYear} onChange={(e) => setPayYear(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Gross salary</Label>
                        <Input type="number" value={payGross} onChange={(e) => setPayGross(e.target.value)} placeholder="₹" />
                      </div>
                      <div className="space-y-2">
                        <Label>Net salary</Label>
                        <Input type="number" value={payNet} onChange={(e) => setPayNet(e.target.value)} placeholder="₹" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>PDF file</Label>
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-secondary/30 cursor-pointer hover:border-primary/40 transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{payFile ? payFile.name : "Select payslip PDF"}</span>
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => setPayFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <Button onClick={uploadPayslip} disabled={paySubmitting} className="w-full gradient-accent text-primary-foreground font-semibold">
                      {paySubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={newsOpen} onOpenChange={setNewsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-3 flex-col gap-1.5 border-border hover:border-primary/40 text-xs">
                    <Megaphone className="h-4 w-4 text-primary" /> Post News
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Post Company News</DialogTitle>
                    <DialogDescription>Share an announcement with all employees</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2"><Label>Title</Label><Input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="News headline..." /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={newsDesc} onChange={(e) => setNewsDesc(e.target.value)} placeholder="Details..." rows={4} /></div>
                    <Button onClick={postNews} disabled={newsSubmitting} className="w-full gradient-accent text-primary-foreground font-semibold">
                      {newsSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={docOpen} onOpenChange={setDocOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-3 flex-col gap-1.5 border-border hover:border-primary/40 text-xs">
                    <FileText className="h-4 w-4 text-primary" /> Upload Doc
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>Upload a company document for employees</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2"><Label>Title</Label><Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document name..." /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={docDesc} onChange={(e) => setDocDesc(e.target.value)} placeholder="Brief description..." rows={2} /></div>
                    <div className="space-y-2">
                      <Label>File</Label>
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-secondary/30 cursor-pointer hover:border-primary/40 transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{docFile ? docFile.name : "Select file"}</span>
                        <input type="file" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <Button onClick={uploadDocument} disabled={docSubmitting} className="w-full gradient-accent text-primary-foreground font-semibold">
                      {docSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </TabsContent>

        {/* ══════════ EMPLOYEES TAB ══════════ */}
        <TabsContent value="employees" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by name, email, dept, code..." className="pl-10" />
          </div>
          <p className="text-xs text-muted-foreground">{filteredEmps.length} employees</p>
          {filteredEmps.map((e) => (
            <EmployeeCard key={e.id} emp={e} role={roleMap.get(e.user_id) ?? "employee"} onRoleChange={changeRole} onUpdate={updateEmployee} />
          ))}
        </TabsContent>

        {/* ══════════ LEAVES TAB ══════════ */}
        <TabsContent value="leaves" className="space-y-3 mt-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <Button key={f} size="sm" variant={leaveFilter === f ? "default" : "outline"}
                onClick={() => setLeaveFilter(f)}
                className={`text-xs capitalize ${leaveFilter === f ? "gradient-accent text-primary-foreground" : ""}`}>
                {f} {f !== "all" && `(${allLeaves.filter(l => l.status === f).length})`}
              </Button>
            ))}
          </div>
          {filteredLeaves.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No {leaveFilter} leave requests</p>}
          {filteredLeaves.map((l) => (
            <AdminLeaveCard key={l.id} leave={l} empName={empName(l.user_id)} onAction={handleLeaveAction} />
          ))}
        </TabsContent>

        {/* ══════════ REIMBURSEMENTS TAB ══════════ */}
        <TabsContent value="reimbs" className="space-y-3 mt-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(["pending", "approved", "rejected", "paid", "all"] as const).map((f) => (
              <Button key={f} size="sm" variant={reimbFilter === f ? "default" : "outline"}
                onClick={() => setReimbFilter(f)}
                className={`text-xs capitalize ${reimbFilter === f ? "gradient-accent text-primary-foreground" : ""}`}>
                {f} {f !== "all" && `(${allReimbs.filter(r => r.status === f).length})`}
              </Button>
            ))}
          </div>
          {filteredReimbs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No {reimbFilter} claims</p>}
          {filteredReimbs.map((r) => (
            <AdminReimbCard key={r.id} item={r} empName={empName(r.user_id)} onAction={handleReimbAction} />
          ))}
        </TabsContent>

        {/* ══════════ CONTENT TAB ══════════ */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Dialog open={newsOpen} onOpenChange={setNewsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border hover:border-primary/40">
                  <Megaphone className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Post News</span>
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={docOpen} onOpenChange={setDocOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border hover:border-primary/40">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Upload Document</span>
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2 border-border hover:border-primary/40">
                <IndianRupee className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Upload Payslip</span>
              </Button>
            </DialogTrigger>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ─── Sub-components ─── */
/* ═══════════════════════════════════════════ */

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: string | number; color: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border p-4 text-left hover:border-primary/30 transition-colors w-full"
    >
      <Icon className={`h-5 w-5 ${color} mb-2`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular mt-0.5">{value}</p>
    </button>
  );
}

function EmployeeCard({ emp, role, onRoleChange, onUpdate }: {
  emp: Employee; role: "admin" | "employee";
  onRoleChange: (uid: string, r: "admin" | "employee") => void;
  onUpdate: (id: string, updates: Partial<Employee>) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: emp.full_name, phone: emp.phone ?? "", department: emp.department ?? "",
    designation: emp.designation ?? "", employee_code: emp.employee_code ?? "",
  });
  const [saving, setSaving] = useState(false);

  const initials = emp.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    const ok = await onUpdate(emp.id, {
      full_name: form.full_name, phone: form.phone || null,
      department: form.department || null, designation: form.designation || null,
      employee_code: form.employee_code || null,
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold flex-shrink-0 overflow-hidden">
          {emp.avatar_url ? <img src={emp.avatar_url} className="h-full w-full object-cover" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{emp.full_name}</p>
            {role === "admin" && <Badge className="text-[9px] px-1.5 py-0 bg-primary/15 text-primary border-primary/30">Admin</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{emp.designation ?? "—"}{emp.department ? ` · ${emp.department}` : ""}</p>
        </div>
        {emp.employee_code && <Badge variant="outline" className="text-[10px] bg-secondary text-muted-foreground flex-shrink-0">{emp.employee_code}</Badge>}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {!editing ? (
            <>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {emp.email}</div>
                {emp.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {emp.phone}</div>}
                {emp.department && <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> {emp.department}</div>}
                {emp.designation && <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-3.5 w-3.5" /> {emp.designation}</div>}
                {emp.employee_code && <div className="flex items-center gap-2 text-muted-foreground"><Hash className="h-3.5 w-3.5" /> {emp.employee_code}</div>}
                {emp.date_of_joining && <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Joined {format(parseISO(emp.date_of_joining), "d MMM yyyy")}</div>}
                <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Leave balance: <span className="text-foreground font-medium">{emp.leave_balance} days</span></div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs gap-1">
                  <Edit2 className="h-3 w-3" /> Edit
                </Button>
                <Select value={role} onValueChange={(v) => onRoleChange(emp.user_id, v as "admin" | "employee")}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <Shield className="h-3 w-3 mr-1" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="h-8 text-xs" /></div>
                <div className="space-y-1 col-span-2"><Label className="text-xs">Employee Code</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} className="h-8 text-xs" /></div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gradient-accent text-primary-foreground">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminLeaveCard({ leave, empName, onAction }: {
  leave: LeaveReq; empName: string;
  onAction: (id: string, a: "approved" | "rejected", notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const days = differenceInCalendarDays(parseISO(leave.end_date), parseISO(leave.start_date)) + 1;
  const isPending = leave.status === "pending";

  const act = async (a: "approved" | "rejected") => {
    setActing(true);
    await onAction(leave.id, a, notes);
    setActing(false);
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{empName}</p>
          <p className="text-xs text-muted-foreground capitalize">{leave.leave_type} · {days} day{days > 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">{format(parseISO(leave.start_date), "d MMM")} — {format(parseISO(leave.end_date), "d MMM yyyy")}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${STATUS_COLORS[leave.status] ?? ""}`}>
          {leave.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
          {leave.status === "approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
          {leave.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
          {leave.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{leave.reason}</p>
      {leave.reviewer_notes && (
        <div className="rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Admin note:</span> {leave.reviewer_notes}
        </div>
      )}
      {isPending && (
        <>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-8" />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => act("approved")} disabled={acting} className="gradient-accent text-primary-foreground font-semibold text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => act("rejected")} disabled={acting} className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AdminReimbCard({ item, empName, onAction }: {
  item: ReimbReq; empName: string;
  onAction: (id: string, a: "approved" | "rejected" | "paid", notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const isPending = item.status === "pending";
  const isApproved = item.status === "approved";

  const act = async (a: "approved" | "rejected" | "paid") => {
    setActing(true);
    await onAction(item.id, a, notes);
    setActing(false);
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{empName}</p>
          <p className="text-xs text-muted-foreground">{item.category} · {format(parseISO(item.expense_date), "d MMM yyyy")}</p>
          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular">₹{item.amount.toLocaleString("en-IN")}</p>
          <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-semibold mt-1 ${STATUS_COLORS[item.status] ?? ""}`}>
            {item.status}
          </Badge>
        </div>
      </div>
      {item.reviewer_notes && (
        <div className="rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Admin note:</span> {item.reviewer_notes}
        </div>
      )}
      {(isPending || isApproved) && (
        <>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-8" />
          <div className={`grid gap-2 ${isPending ? "grid-cols-3" : "grid-cols-2"}`}>
            {isPending && (
              <Button size="sm" onClick={() => act("approved")} disabled={acting} className="gradient-accent text-primary-foreground font-semibold text-xs">Approve</Button>
            )}
            {(isPending || isApproved) && (
              <Button size="sm" variant="outline" onClick={() => act("paid")} disabled={acting} className="border-primary/40 text-primary text-xs">Mark Paid</Button>
            )}
            {isPending && (
              <Button size="sm" variant="outline" onClick={() => act("rejected")} disabled={acting} className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">Reject</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
