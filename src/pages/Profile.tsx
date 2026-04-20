import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, Camera, Loader2 } from "lucide-react";

interface Employee {
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  employee_code: string | null;
  date_of_joining: string | null;
  avatar_url: string | null;
}

export default function Profile() {
  const { user, signOut, role } = useAuth();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("employees").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setEmp(data as Employee | null));
  }, [user]);

  const save = async () => {
    if (!user || !emp) return;
    setSaving(true);
    const { error } = await supabase.from("employees").update({
      full_name: emp.full_name,
      phone: emp.phone,
      department: emp.department,
      designation: emp.designation,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await supabase.from("employees").update({ avatar_url: url }).eq("user_id", user.id);
    setEmp((p) => p ? { ...p, avatar_url: url } : p);
    setUploading(false);
    toast.success("Photo updated");
  };

  if (!emp) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const initials = emp.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="px-5 pt-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information</p>
      </header>

      <div className="rounded-2xl gradient-card border border-border p-6 flex flex-col items-center text-center shadow-elevated">
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold overflow-hidden ring-2 ring-primary/30">
            {emp.avatar_url ? <img src={emp.avatar_url} alt={emp.full_name} className="h-full w-full object-cover" /> : initials}
          </div>
          <label className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full gradient-accent flex items-center justify-center cursor-pointer shadow-glow">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Camera className="h-4 w-4 text-primary-foreground" />}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </label>
        </div>
        <h2 className="text-lg font-semibold mt-4">{emp.full_name}</h2>
        <p className="text-sm text-muted-foreground">{emp.designation ?? "—"} {emp.department && `· ${emp.department}`}</p>
        <span className="mt-3 text-xs px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium capitalize">{role}</span>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={emp.full_name} onChange={(e) => setEmp({ ...emp, full_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={emp.email} disabled className="opacity-70" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={emp.phone ?? ""} onChange={(e) => setEmp({ ...emp, phone: e.target.value })} placeholder="+91 ..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="dept">Department</Label>
            <Input id="dept" value={emp.department ?? ""} onChange={(e) => setEmp({ ...emp, department: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desig">Designation</Label>
            <Input id="desig" value={emp.designation ?? ""} onChange={(e) => setEmp({ ...emp, designation: e.target.value })} />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full gradient-accent text-primary-foreground font-semibold">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
        </Button>
      </div>

      <Button onClick={signOut} variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
