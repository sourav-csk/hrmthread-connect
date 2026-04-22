import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  employeeName: string;
  currentBalance: number;
}

const STATUS_ICON = { pending: Clock, approved: CheckCircle2, rejected: XCircle };
const STATUS_COLOR: Record<string, string> = {
  pending: "text-warning",
  approved: "text-primary",
  rejected: "text-destructive",
};

export default function LeaveBalanceHistory({ open, onOpenChange, userId, employeeName, currentBalance }: Props) {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("leaves")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeaves((data ?? []) as LeaveRecord[]);
        setLoading(false);
      });
  }, [open, userId]);

  // Compute running balance (walk from oldest to newest)
  const approvedLeaves = leaves
    .filter((l) => l.status === "approved" && l.leave_type !== "unpaid")
    .sort((a, b) => new Date(a.reviewed_at ?? a.created_at).getTime() - new Date(b.reviewed_at ?? b.created_at).getTime());

  // Reconstruct: start from (currentBalance + total deducted) and walk forward
  const totalDeducted = approvedLeaves.reduce((s, l) => {
    return s + differenceInCalendarDays(parseISO(l.end_date), parseISO(l.start_date)) + 1;
  }, 0);
  const startingBalance = currentBalance + totalDeducted;

  let runningBalance = startingBalance;
  const timeline = approvedLeaves.map((l) => {
    const days = differenceInCalendarDays(parseISO(l.end_date), parseISO(l.start_date)) + 1;
    const before = runningBalance;
    runningBalance = Math.max(runningBalance - days, 0);
    return { ...l, days, balanceBefore: before, balanceAfter: runningBalance };
  });
  // Reverse for display (newest first)
  timeline.reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Leave History — {employeeName}</DialogTitle>
        </DialogHeader>

        {/* Balance summary */}
        <div className="rounded-xl bg-secondary/40 border border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current balance</p>
            <p className="text-2xl font-bold tabular">{currentBalance}<span className="text-sm font-medium text-muted-foreground ml-1">days</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Starting balance</p>
            <p className="text-lg font-semibold tabular text-muted-foreground">{startingBalance} days</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-lg font-bold tabular text-primary">{leaves.filter(l => l.status === "approved").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
          </div>
          <div className="rounded-lg bg-warning/10 p-2">
            <p className="text-lg font-bold tabular text-warning">{leaves.filter(l => l.status === "pending").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-2">
            <p className="text-lg font-bold tabular text-destructive">{leaves.filter(l => l.status === "rejected").length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rejected</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No leave records found</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">All Leave Requests</p>
            {leaves.map((l) => {
              const Icon = STATUS_ICON[l.status as keyof typeof STATUS_ICON] ?? Clock;
              const days = differenceInCalendarDays(parseISO(l.end_date), parseISO(l.start_date)) + 1;
              const timelineEntry = timeline.find((t) => t.id === l.id);

              return (
                <div key={l.id} className="rounded-xl border border-border p-3 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold capitalize">{l.leave_type} leave</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(l.start_date), "d MMM")} — {format(parseISO(l.end_date), "d MMM yyyy")}
                        <span className="ml-1 text-foreground/70">({days} day{days > 1 ? "s" : ""})</span>
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-semibold ${STATUS_COLOR[l.status] ?? ""}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {l.status}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground">{l.reason}</p>

                  {/* Balance impact for approved non-unpaid */}
                  {timelineEntry && (
                    <div className="flex items-center gap-2 text-[11px] rounded-lg bg-primary/5 px-2.5 py-1.5 border border-primary/10">
                      <TrendingDown className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Balance: <span className="font-semibold text-foreground">{timelineEntry.balanceBefore}</span>
                        <span className="mx-1">→</span>
                        <span className="font-semibold text-foreground">{timelineEntry.balanceAfter}</span>
                        <span className="text-destructive ml-1">(−{timelineEntry.days})</span>
                      </span>
                    </div>
                  )}

                  {l.status === "approved" && l.leave_type === "unpaid" && (
                    <div className="flex items-center gap-2 text-[11px] rounded-lg bg-secondary/50 px-2.5 py-1.5">
                      <Minus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Unpaid — no balance deduction</span>
                    </div>
                  )}

                  {l.reviewer_notes && (
                    <div className="rounded-lg bg-secondary/50 p-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/70">Admin:</span> {l.reviewer_notes}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Applied {format(parseISO(l.created_at), "d MMM yyyy, HH:mm")}
                    {l.reviewed_at && ` · Reviewed ${format(parseISO(l.reviewed_at), "d MMM yyyy")}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
