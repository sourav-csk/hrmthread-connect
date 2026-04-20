import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, CheckCircle2, AlertTriangle, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SelfieCapture from "@/components/SelfieCapture";
import { euclideanDistance, MATCH_DISTANCE_THRESHOLD } from "@/lib/faceApi";

interface AttRow { id: string; check_in_at: string | null; check_out_at: string | null; face_match_score: number | null; }

export default function Attendance() {
  const { user } = useAuth();
  const [att, setAtt] = useState<AttRow | null>(null);
  const [enrolled, setEnrolled] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"in" | "out" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: e }] = await Promise.all([
        supabase.from("attendance").select("id,check_in_at,check_out_at,face_match_score").eq("user_id", user.id).eq("date", today).maybeSingle(),
        supabase.from("employees").select("face_descriptor").eq("user_id", user.id).maybeSingle(),
      ]);
      setAtt(a as AttRow | null);
      const fd = (e?.face_descriptor ?? null) as number[] | null;
      setEnrolled(Array.isArray(fd) && fd.length > 0 ? fd : null);
      setLoading(false);
    })();
  }, [user, today]);

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
          setSubmitting(false);
          return;
        }
      }

      const path = `${user.id}/${today}-${mode}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const nowIso = new Date().toISOString();

      if (mode === "in") {
        const payload = {
          user_id: user.id,
          date: today,
          check_in_at: nowIso,
          check_in_selfie_url: path,
          face_match_score: score,
          status: "present",
        };
        const { data, error } = await supabase.from("attendance").upsert(payload, { onConflict: "user_id,date" }).select().single();
        if (error) throw error;
        setAtt(data as AttRow);
        toast.success("Checked in");
      } else {
        if (!att) throw new Error("No check-in found for today");
        const { data, error } = await supabase.from("attendance").update({
          check_out_at: nowIso,
          check_out_selfie_url: path,
        }).eq("id", att.id).select().single();
        if (error) throw error;
        setAtt(data as AttRow);
        toast.success("Checked out");
      }
      setMode(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  const checkedIn = !!att?.check_in_at;
  const checkedOut = !!att?.check_out_at;

  return (
    <div className="px-5 pt-8 space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </header>

      <div className="rounded-2xl gradient-card border border-border p-5 shadow-elevated">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Check-in</p>
            <p className="text-2xl font-bold tabular mt-1">
              {att?.check_in_at ? format(new Date(att.check_in_at), "HH:mm") : "--:--"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Check-out</p>
            <p className="text-2xl font-bold tabular mt-1">
              {att?.check_out_at ? format(new Date(att.check_out_at), "HH:mm") : "--:--"}
            </p>
          </div>
        </div>
        {att?.face_match_score != null && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            Face match {(att.face_match_score * 100).toFixed(0)}%
          </p>
        )}
      </div>

      {!enrolled && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--warning))" }} />
          <div className="text-sm">
            <p className="font-semibold">Face not enrolled</p>
            <p className="text-muted-foreground text-xs mt-0.5">Enroll your face on the Profile page to enable face-matched attendance.</p>
          </div>
        </div>
      )}

      {mode ? (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            {mode === "in" ? "Check-in selfie" : "Check-out selfie"}
          </p>
          {submitting ? (
            <div className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <SelfieCapture onCapture={handleCapture} onCancel={() => setMode(null)} requireFace={!!enrolled} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setMode("in")}
            disabled={checkedIn}
            className="h-14 gradient-accent text-primary-foreground font-semibold"
          >
            <LogIn className="h-4 w-4" /> Check in
          </Button>
          <Button
            onClick={() => setMode("out")}
            disabled={!checkedIn || checkedOut}
            variant="outline"
            className="h-14 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary font-semibold"
          >
            <LogOut className="h-4 w-4" /> Check out
          </Button>
        </div>
      )}
    </div>
  );
}
