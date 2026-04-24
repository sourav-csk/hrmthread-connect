import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, CheckCircle2, AlertTriangle, LogIn, LogOut, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isFuture, differenceInMinutes, parseISO, subMonths, addMonths } from "date-fns";
import { toast } from "sonner";
import SelfieCapture from "@/components/SelfieCapture";
import { euclideanDistance, MATCH_DISTANCE_THRESHOLD } from "@/lib/faceApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AttRow {
  id: string; date: string; check_in_at: string | null; check_out_at: string | null;
  face_match_score: number | null; status: string;
}

export default function Attendance() {
  const { user } = useAuth();
  const [att, setAtt] = useState<AttRow | null>(null);
  const [enrolled, setEnrolled] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"in" | "out" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [histMonth, setHistMonth] = useState(new Date());
  const [monthRecords, setMonthRecords] = useState<AttRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: e }] = await Promise.all([
        supabase.from("attendance").select("id,date,check_in_at,check_out_at,face_match_score,status").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employees").select("face_descriptor").eq("user_id", user.id).maybeSingle(),
      ]);
      setAtt(a as AttRow | null);
      const fd = (e?.face_descriptor ?? null) as number[] | null;
      setEnrolled(Array.isArray(fd) && fd.length > 0 ? fd : null);
      setLoading(false);
    })();
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    setHistLoading(true);
    const start = format(startOfMonth(histMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(histMonth), "yyyy-MM-dd");
    supabase.from("attendance").select("id,date,check_in_at,check_out_at,face_match_score,status")
      .eq("user_id", user.id).gte("date", start).lte("date", end)
      .order("date", { ascending: true })
      .then(({ data }) => { setMonthRecords((data ?? []) as AttRow[]); setHistLoading(false); });
  }, [user, histMonth]);

  const handleCapture = async ({ blob, descriptor }: { blob: Blob; descriptor: number[] | null }) => {
    if (!user || !mode) return;
    setSubmitting(true);
    try {
      let score: number | null = null;
      if (enrolled && descriptor) {
        const dist = euclideanDistance(enrolled, descriptor);
        score = Math.max(0, 1 - dist);
        if (dist > MATCH_DISTANCE_THRESHOLD) {
          toast.error(`Face match failed (score ${(score * 100).toFixed(0)}%). Re-enroll on Profile if needed.`);
          setSubmitting(false); return;
        }
      }
      const path = `${user.id}/${today}-${mode}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const nowIso = new Date().toISOString();
      if (mode === "in") {
        const { data, error } = await supabase.from("attendance").upsert({
          user_id: user.id, date: today, check_in_at: nowIso, check_in_selfie_url: path, face_match_score: score, status: "present",
        }, { onConflict: "user_id,date" }).select().single();
        if (error) throw error;
        setAtt(data as AttRow); toast.success("Checked in successfully");
      } else {
        if (!att) throw new Error("No check-in found for today");
        const { data, error } = await supabase.from("attendance").update({ check_out_at: nowIso, check_out_selfie_url: path }).eq("id", att.id).select().single();
        if (error) throw error;
        setAtt(data as AttRow); toast.success("Checked out successfully");
      }
      setMode(null);
    } catch (e: any) { toast.error(e.message ?? "Failed to mark attendance"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  const checkedIn = !!att?.check_in_at;
  const checkedOut = !!att?.check_out_at;
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(histMonth), end: endOfMonth(histMonth) });
  const firstDayOffset = startOfMonth(histMonth).getDay();
  const recordMap = new Map(monthRecords.map((r) => [r.date, r]));
  const presentDays = monthRecords.filter((r) => r.check_in_at).length;
  const totalHours = monthRecords.reduce((sum, r) => {
    if (r.check_in_at && r.check_out_at) return sum + differenceInMinutes(parseISO(r.check_out_at), parseISO(r.check_in_at));
    return sum;
  }, 0);
  const avgHours = presentDays > 0 ? totalHours / presentDays / 60 : 0;

  return (
    <div className="px-4 xs:px-5 pt-5 xs:pt-6 space-y-4 pb-4">
      <header>
        <h1 className="text-lg xs:text-xl font-bold tracking-tight">Attendance</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </header>

      <Tabs defaultValue="mark" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="mark" className="text-xs font-medium">Mark</TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-medium">History</TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-4 mt-3">
          <div className="rounded-xl bg-card border border-border p-4 shadow-elevated">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Check-in</p>
                <p className="text-2xl font-bold tabular mt-1">{att?.check_in_at ? format(new Date(att.check_in_at), "HH:mm") : "--:--"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Check-out</p>
                <p className="text-2xl font-bold tabular mt-1">{att?.check_out_at ? format(new Date(att.check_out_at), "HH:mm") : "--:--"}</p>
              </div>
            </div>
            {checkedIn && checkedOut && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Total: <span className="text-foreground font-semibold">{(differenceInMinutes(parseISO(att!.check_out_at!), parseISO(att!.check_in_at!)) / 60).toFixed(1)}h</span>
                </p>
              </div>
            )}
            {att?.face_match_score != null && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Face match {(att.face_match_score * 100).toFixed(0)}%
              </p>
            )}
          </div>

          {!enrolled && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
              <div className="text-xs">
                <p className="font-semibold">Face not enrolled</p>
                <p className="text-muted-foreground mt-0.5">Enroll your face on Profile to enable selfie attendance.</p>
              </div>
            </div>
          )}

          {mode ? (
            <div className="rounded-xl bg-card border border-border p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                {mode === "in" ? "Check-in selfie" : "Check-out selfie"}
              </p>
              {submitting ? (
                <div className="py-12 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <SelfieCapture onCapture={handleCapture} onCancel={() => setMode(null)} requireFace={!!enrolled} />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setMode("in")} disabled={checkedIn} className="h-12 font-medium">
                <LogIn className="h-4 w-4" /> Check in
              </Button>
              <Button onClick={() => setMode("out")} disabled={!checkedIn || checkedOut} variant="outline" className="h-12 font-medium">
                <LogOut className="h-4 w-4" /> Check out
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Present", value: presentDays, suffix: "" },
              { label: "Total hrs", value: (totalHours / 60).toFixed(0), suffix: "h" },
              { label: "Avg/day", value: avgHours.toFixed(1), suffix: "h" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-card border border-border p-3 text-center shadow-elevated">
                <p className="text-lg font-bold tabular">{s.value}<span className="text-xs font-normal text-muted-foreground">{s.suffix}</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setHistMonth(subMonths(histMonth, 1))} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold">{format(histMonth, "MMMM yyyy")}</p>
            <Button variant="ghost" size="icon" onClick={() => setHistMonth(addMonths(histMonth, 1))} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-xl bg-card border border-border p-3 shadow-elevated">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="text-[10px] text-muted-foreground font-medium">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
              {daysInMonth.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const rec = recordMap.get(dateStr);
                const present = !!rec?.check_in_at;
                const isT = isToday(day);
                const future = isFuture(day);
                return (
                  <div key={dateStr} className={`
                    relative h-8 flex items-center justify-center rounded-md text-xs font-medium
                    ${isT ? "ring-1.5 ring-primary bg-primary/5" : ""}
                    ${present ? "bg-success/10 text-success" : future ? "text-muted-foreground/30" : "text-muted-foreground"}
                  `}>
                    {day.getDate()}
                    {present && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-success" />}
                  </div>
                );
              })}
            </div>
          </div>

          {histLoading ? (
            <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></div>
          ) : (
            <div className="space-y-1.5">
              {monthRecords.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No records this month</p>}
              {[...monthRecords].reverse().map((r) => {
                const hrs = r.check_in_at && r.check_out_at ? (differenceInMinutes(parseISO(r.check_out_at), parseISO(r.check_in_at)) / 60).toFixed(1) : null;
                return (
                  <div key={r.id} className="rounded-lg bg-card border border-border p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{format(parseISO(r.date), "EEE, d MMM")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.check_in_at ? format(parseISO(r.check_in_at), "HH:mm") : "--:--"} → {r.check_out_at ? format(parseISO(r.check_out_at), "HH:mm") : "--:--"}
                      </p>
                    </div>
                    <div className="text-right">
                      {hrs && <p className="text-sm font-semibold tabular">{hrs}h</p>}
                      {r.face_match_score != null && (
                        <p className="text-[10px] text-success flex items-center gap-1 justify-end"><CheckCircle2 className="h-3 w-3" /> {(r.face_match_score * 100).toFixed(0)}%</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
