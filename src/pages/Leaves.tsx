import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

type LeaveType = "casual" | "sick" | "earned" | "unpaid";
type LeaveStatus = "pending" | "approved" | "rejected";

interface LeaveRow {
  id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  reviewer_notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_ICONS: Record<LeaveStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const LEAVE_LABELS: Record<LeaveType, string> = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  earned: "Earned Leave",
  unpaid: "Unpaid Leave",
};

export default function Leaves() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: l }, { data: e }] = await Promise.all([
        supabase.from("leaves").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("employees").select("leave_balance").eq("user_id", user.id).maybeSingle(),
      ]);
      setLeaves((l ?? []) as LeaveRow[]);
      setBalance(e?.leave_balance ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const resetForm = () => {
    setLeaveType("casual");
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!startDate || !endDate || !reason.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be after start date");
      return;
    }

    const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
    if (leaveType !== "unpaid" && days > balance) {
      toast.error(`Insufficient leave balance (${balance} days remaining)`);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from("leaves").insert({
      user_id: user.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else {
      setLeaves((prev) => [data as LeaveRow, ...prev]);
      toast.success("Leave application submitted");
      resetForm();
      setOpen(false);
    }
    setSubmitting(false);
  };

  const pending = leaves.filter((l) => l.status === "pending");
  const past = leaves.filter((l) => l.status !== "pending");

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="px-5 pt-8 space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaves</h1>
          <p className="text-sm text-muted-foreground mt-1">Apply & track your leaves</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-accent text-primary-foreground font-semibold h-10 px-4">
              <Plus className="h-4 w-4" /> Apply
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Leave type</Label>
                <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="earned">Earned Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              {startDate && endDate && endDate >= startDate && (
                <p className="text-xs text-muted-foreground">
                  Duration: <span className="text-foreground font-medium">
                    {differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1} day(s)
                  </span>
                </p>
              )}
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for leave..." rows={3} />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full gradient-accent text-primary-foreground font-semibold"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Application
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Balance card */}
      <div className="rounded-2xl gradient-card border border-border p-5 shadow-elevated">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="text-3xl font-bold tabular">{balance}<span className="text-sm font-medium text-muted-foreground ml-1.5">days</span></p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-bold tabular text-primary">{leaves.filter((l) => l.status === "approved").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular text-warning">{pending.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular text-destructive">{leaves.filter((l) => l.status === "rejected").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rejected</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-secondary/60">
          <TabsTrigger value="pending" className="text-sm">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="past" className="text-sm">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 mt-4">
          {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pending leave applications</p>}
          {pending.map((l) => <LeaveCard key={l.id} leave={l} />)}
        </TabsContent>

        <TabsContent value="past" className="space-y-2 mt-4">
          {past.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No past leave records</p>}
          {past.map((l) => <LeaveCard key={l.id} leave={l} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaveCard({ leave }: { leave: LeaveRow }) {
  const Icon = STATUS_ICONS[leave.status];
  const days = differenceInCalendarDays(parseISO(leave.end_date), parseISO(leave.start_date)) + 1;

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{LEAVE_LABELS[leave.leave_type]}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(leave.start_date), "d MMM")} — {format(parseISO(leave.end_date), "d MMM yyyy")}
            <span className="ml-1.5 text-foreground/70">({days} day{days > 1 ? "s" : ""})</span>
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${STATUS_COLORS[leave.status]}`}>
          <Icon className="h-3 w-3 mr-1" />
          {leave.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{leave.reason}</p>
      {leave.reviewer_notes && (
        <div className="rounded-lg bg-secondary/50 p-2.5 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{leave.reviewer_notes}</p>
        </div>
      )}
    </div>
  );
}
