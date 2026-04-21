import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Users, CalendarDays, CheckCircle2, XCircle, Clock,
  Upload, FileText, Megaphone, IndianRupee, Plus, Search
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

/* ─── Types ─── */
interface Employee { id: string; user_id: string; full_name: string; email: string; department: string | null; designation: string | null; employee_code: string | null; }
interface LeaveReq { id: string; user_id: string; leave_type: string; start_date: string; end_date: string; reason: string; status: string; reviewer_notes: string | null; created_at: string; }
interface ReimbReq { id: string; user_id: string; category: string; amount: number; expense_date: string; description: string | null; status: string; reviewer_notes: string | null; created_at: string; }

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AdminConsole() {
  const { user } = useAuth();
  const [tab, setTab] = useState("employees");
  const [loading, setLoading] = useState(true);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [reimbs, setReimbs] = useState<ReimbReq[]>([]);
  const [searchQ, setSearchQ] = useState("");

  // Upload payslip
  const [payOpen, setPayOpen] = useState(false);
  const [payUserId, setPayUserId] = useState("");
  const [payMonth, setPayMonth] = useState(String(new Date().getMonth() + 1));
  const [payYear, setPayYear] = useState(String(new Date().getFullYear()));
  const [payGross, setPayGross] = useState("");
  const [payNet, setPayNet] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Post news
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsDesc, setNewsDesc] = useState("");
  const [newsSubmitting, setNewsSubmitting] = useState(false);

  // Upload document
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docSubmitting, setDocSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: e }, { data: l }, { data: r }] = await Promise.all([
        supabase.from("employees").select("id,user_id,full_name,email,department,designation,employee_code").order("full_name"),
        supabase.from("leaves").select("*").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("reimbursements").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      ]);
      setEmployees((e ?? []) as Employee[]);
      setLeaves((l ?? []) as LeaveReq[]);
      setReimbs((r ?? []) as ReimbReq[]);
      setLoading(false);
    })();
  }, [user]);

  const empMap = new Map(employees.map((e) => [e.user_id, e.full_name]));
  const empName = (uid: string) => empMap.get(uid) ?? "Unknown";

  /* ─── Leave actions ─── */
  const handleLeaveAction = async (id: string, action: "approved" | "rejected", notes: string) => {
    const { error } = await supabase.from("leaves").update({
      status: action,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setLeaves((prev) => prev.filter((l) => l.id !== id));
    toast.success(`Leave ${action}`);
  };

  /* ─── Reimbursement actions ─── */
  const handleReimbAction = async (id: string, action: "approved" | "rejected" | "paid", notes: string) => {
    const { error } = await supabase.from("reimbursements").update({
      status: action,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setReimbs((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Claim ${action}`);
  };

  /* ─── Upload payslip ─── */
  const uploadPayslip = async () => {
    if (!payUserId || !payFile) { toast.error("Select employee and upload PDF"); return; }
    setPaySubmitting(true);
    try {
      const path = `${payUserId}/${payYear}-${payMonth.padStart(2, "0")}.pdf`;
      const { error: upErr } = await supabase.storage.from("payslips").upload(path, payFile, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("payslips").insert({
        user_id: payUserId,
        month: parseInt(payMonth),
        year: parseInt(payYear),
        gross_salary: payGross ? parseFloat(payGross) : null,
        net_salary: payNet ? parseFloat(payNet) : null,
        file_path: path,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success("Payslip uploaded");
      setPayOpen(false);
      setPayFile(null);
      setPayGross("");
      setPayNet("");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
    setPaySubmitting(false);
  };

  /* ─── Post news ─── */
  const postNews = async () => {
    if (!newsTitle.trim()) { toast.error("Title is required"); return; }
    setNewsSubmitting(true);
    const { error } = await supabase.from("documents").insert({
      title: newsTitle.trim(),
      description: newsDesc.trim() || null,
      doc_type: "news" as const,
      uploaded_by: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("News posted"); setNewsOpen(false); setNewsTitle(""); setNewsDesc(""); }
    setNewsSubmitting(false);
  };

  /* ─── Upload document ─── */
  const uploadDocument = async () => {
    if (!docTitle.trim() || !docFile) { toast.error("Title and file are required"); return; }
    setDocSubmitting(true);
    try {
      const path = `company/${Date.now()}-${docFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, docFile, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        title: docTitle.trim(),
        description: docDesc.trim() || null,
        doc_type: "document" as const,
        file_path: path,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success("Document uploaded");
      setDocOpen(false);
      setDocTitle("");
      setDocDesc("");
      setDocFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
    setDocSubmitting(false);
  };

  const filteredEmps = employees.filter((e) =>
    e.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQ.toLowerCase()) ||
    (e.department ?? "").toLowerCase().includes(searchQ.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="px-5 pt-8 space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage employees, approvals & content</p>
      </header>

      {/* Quick action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1.5 border-border hover:border-primary/40">
              <IndianRupee className="h-5 w-5 text-primary" />
              <span className="text-[10px]">Upload Payslip</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader><DialogTitle>Upload Payslip</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={payUserId} onValueChange={setPayUserId}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={payMonth} onValueChange={setPayMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
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
            <Button variant="outline" className="h-auto py-3 flex-col gap-1.5 border-border hover:border-primary/40">
              <Megaphone className="h-5 w-5 text-primary" />
              <span className="text-[10px]">Post News</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader><DialogTitle>Post Company News</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="News headline..." />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newsDesc} onChange={(e) => setNewsDesc(e.target.value)} placeholder="Details..." rows={4} />
              </div>
              <Button onClick={postNews} disabled={newsSubmitting} className="w-full gradient-accent text-primary-foreground font-semibold">
                {newsSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={docOpen} onOpenChange={setDocOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1.5 border-border hover:border-primary/40">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-[10px]">Upload Doc</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document name..." />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={docDesc} onChange={(e) => setDocDesc(e.target.value)} placeholder="Brief description..." rows={2} />
              </div>
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

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-secondary/60">
          <TabsTrigger value="employees" className="text-sm">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Team
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-sm">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Leaves ({leaves.length})
          </TabsTrigger>
          <TabsTrigger value="reimbs" className="text-sm">
            <IndianRupee className="h-3.5 w-3.5 mr-1.5" /> Claims ({reimbs.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Employees ─── */}
        <TabsContent value="employees" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search employees..."
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">{filteredEmps.length} employees</p>
          {filteredEmps.map((e) => (
            <div key={e.id} className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold">
                {e.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{e.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{e.designation ?? "—"} {e.department && `· ${e.department}`}</p>
                <p className="text-[10px] text-muted-foreground truncate">{e.email}</p>
              </div>
              {e.employee_code && (
                <Badge variant="outline" className="text-[10px] bg-secondary text-muted-foreground">{e.employee_code}</Badge>
              )}
            </div>
          ))}
        </TabsContent>

        {/* ─── Leaves ─── */}
        <TabsContent value="leaves" className="space-y-2 mt-4">
          {leaves.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pending leave requests</p>}
          {leaves.map((l) => (
            <AdminLeaveCard key={l.id} leave={l} empName={empName(l.user_id)} onAction={handleLeaveAction} />
          ))}
        </TabsContent>

        {/* ─── Reimbursements ─── */}
        <TabsContent value="reimbs" className="space-y-2 mt-4">
          {reimbs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pending claims</p>}
          {reimbs.map((r) => (
            <AdminReimbCard key={r.id} item={r} empName={empName(r.user_id)} onAction={handleReimbAction} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Sub-components ─── */

function AdminLeaveCard({ leave, empName, onAction }: { leave: LeaveReq; empName: string; onAction: (id: string, a: "approved" | "rejected", notes: string) => void }) {
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const days = differenceInCalendarDays(parseISO(leave.end_date), parseISO(leave.start_date)) + 1;

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
          <p className="text-xs text-muted-foreground">
            {format(parseISO(leave.start_date), "d MMM")} — {format(parseISO(leave.end_date), "d MMM yyyy")}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS.pending}`}>
          <Clock className="h-3 w-3 mr-1" /> pending
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{leave.reason}</p>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-9" />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => act("approved")} disabled={acting} className="gradient-accent text-primary-foreground font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => act("rejected")} disabled={acting} className="border-destructive/40 text-destructive hover:bg-destructive/10">
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}

function AdminReimbCard({ item, empName, onAction }: { item: ReimbReq; empName: string; onAction: (id: string, a: "approved" | "rejected" | "paid", notes: string) => void }) {
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

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
        <p className="text-sm font-bold tabular">₹{item.amount.toLocaleString("en-IN")}</p>
      </div>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-9" />
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" onClick={() => act("approved")} disabled={acting} className="gradient-accent text-primary-foreground font-semibold text-xs">
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => act("paid")} disabled={acting} className="border-primary/40 text-primary text-xs">
          Mark Paid
        </Button>
        <Button size="sm" variant="outline" onClick={() => act("rejected")} disabled={acting} className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">
          Reject
        </Button>
      </div>
    </div>
  );
}
