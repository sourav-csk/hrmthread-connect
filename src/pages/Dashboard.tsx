import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ArrowRight, CalendarDays, Wallet, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface Employee {
  full_name: string;
  designation: string | null;
  department: string | null;
  avatar_url: string | null;
  leave_balance: number;
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<{ check_in_at: string | null; check_out_at: string | null } | null>(null);
  const [pendingReimb, setPendingReimb] = useState(0);
  const [latestNews, setLatestNews] = useState<{ title: string; description: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    (async () => {
      const [{ data: e }, { data: a }, { data: r }, { data: n }] = await Promise.all([
        supabase.from("employees").select("full_name,designation,department,avatar_url,leave_balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("attendance").select("check_in_at,check_out_at").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("reimbursements").select("amount").eq("user_id", user.id).eq("status", "pending"),
        supabase.from("documents").select("title,description").eq("doc_type", "news").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setEmp(e as Employee | null);
      setTodayAttendance(a);
      setPendingReimb((r ?? []).reduce((s, x: any) => s + Number(x.amount || 0), 0));
      setLatestNews(n);
    })();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const initials = (emp?.full_name ?? "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const status = todayAttendance?.check_out_at ? "Checked out" : todayAttendance?.check_in_at ? "Checked in" : "Not checked in";

  return (
    <div className="px-5 pt-6 space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden">
            {emp?.avatar_url ? <img src={emp.avatar_url} alt={emp.full_name} className="h-full w-full object-cover" /> : initials}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{greeting}</p>
            <h1 className="text-base font-semibold leading-tight">{emp?.full_name ?? "Welcome"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <Link to="/admin" className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium">
              Admin
            </Link>
          )}
          <button aria-label="Notifications" className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-surface-3 transition-colors">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Attendance card */}
      <Link to="/attendance" className="block">
        <div className="rounded-xl bg-card border border-border p-5 shadow-elevated">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-sm font-semibold mt-0.5">{format(new Date(), "EEEE, d MMM")}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
              todayAttendance?.check_in_at ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            }`}>
              {status}
            </span>
          </div>

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-3xl font-bold tabular tracking-tight">
                {todayAttendance?.check_in_at ? format(new Date(todayAttendance.check_in_at), "HH:mm") : "--:--"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Check-in</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular tracking-tight text-muted-foreground">
                {todayAttendance?.check_out_at ? format(new Date(todayAttendance.check_out_at), "HH:mm") : "--:--"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Check-out</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm font-medium">Mark attendance</span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </div>
        </div>
      </Link>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/leaves" className="rounded-xl bg-card border border-border p-4 shadow-elevated hover:border-primary/30 transition-colors">
          <CalendarDays className="h-4.5 w-4.5 text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Leave balance</p>
          <p className="text-xl font-bold tabular mt-0.5">{emp?.leave_balance ?? 0}<span className="text-xs font-medium text-muted-foreground ml-1">days</span></p>
        </Link>
        <Link to="/reimbursements" className="rounded-xl bg-card border border-border p-4 shadow-elevated hover:border-primary/30 transition-colors">
          <Wallet className="h-4.5 w-4.5 text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Pending claims</p>
          <p className="text-xl font-bold tabular mt-0.5">₹{pendingReimb.toFixed(0)}</p>
        </Link>
      </div>

      {/* News strip */}
      <Link to="/documents" className="block">
        <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3 shadow-elevated">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-primary font-semibold uppercase tracking-wide">Company news</p>
            <p className="text-sm font-medium mt-0.5 line-clamp-1">{latestNews?.title ?? "No news yet"}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{latestNews?.description ?? "Check back soon for updates."}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </Link>
    </div>
  );
}
