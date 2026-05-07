import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoImg from "@/assets/logo.png";

export default function Auth() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Reset link sent. Check your email.");
        setMode("signin");
      }
      return;
    }
    const res = mode === "signin"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, fullName.trim());
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(mode === "signin" ? "Welcome back" : "Account created");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={logoImg} alt="HRMSpine" className="h-10 w-10 rounded-lg object-contain" />
          <h1 className="text-xl font-bold tracking-tight">HRMSpine</h1>
        </div>

        <div className="rounded-xl bg-card border border-border p-6 shadow-elevated">
          <h2 className="text-lg font-semibold mb-1">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            {mode === "signin"
              ? "Welcome back to HRMSpine"
              : mode === "signup"
              ? "Start managing your workday"
              : "We'll email you a secure reset link"}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Anya Sharma" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                      Forgot?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full font-medium">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "signin"
              ? "New here? Create an account"
              : mode === "signup"
              ? "Already have an account? Sign in"
              : "Back to sign in"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-5">
          By continuing you agree to our terms & privacy policy.
        </p>
      </div>
    </div>
  );
}
