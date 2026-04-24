import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Receipt, IndianRupee, FileText } from "lucide-react";
import { toast } from "sonner";

interface Payslip {
  id: string; month: number; year: number; gross_salary: number | null;
  net_salary: number | null; file_path: string; created_at: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Payslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));

  useEffect(() => {
    if (!user) return;
    supabase.from("payslips").select("*").eq("user_id", user.id)
      .order("year", { ascending: false }).order("month", { ascending: false })
      .then(({ data }) => { setPayslips((data ?? []) as Payslip[]); setLoading(false); });
  }, [user]);

  const years = [...new Set(payslips.map((p) => p.year))].sort((a, b) => b - a);
  const filtered = payslips.filter((p) => String(p.year) === filterYear);
  const totalNet = filtered.reduce((s, p) => s + (p.net_salary ?? 0), 0);
  const totalGross = filtered.reduce((s, p) => s + (p.gross_salary ?? 0), 0);

  const handleDownload = async (payslip: Payslip) => {
    setDownloading(payslip.id);
    try {
      const { data, error } = await supabase.storage.from("payslips").download(payslip.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a"); a.href = url;
      a.download = `payslip-${MONTHS[payslip.month - 1]}-${payslip.year}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message ?? "Download failed"); }
    setDownloading(null);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="px-4 xs:px-5 pt-5 xs:pt-6 space-y-4 pb-4">
      <header>
        <h1 className="text-lg xs:text-xl font-bold tracking-tight">Payslips</h1>
        <p className="text-xs text-muted-foreground mt-0.5">View and download salary slips</p>
      </header>

      <div className="rounded-xl bg-card border border-border p-4 shadow-elevated">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net earnings</p>
            <p className="text-xl font-bold tabular">₹{totalNet.toLocaleString("en-IN")}</p>
          </div>
          {years.length > 0 && (
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        {totalGross > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <div><p className="text-[10px] text-muted-foreground uppercase">Gross (YTD)</p><p className="text-sm font-semibold tabular mt-0.5">₹{totalGross.toLocaleString("en-IN")}</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase">Net (YTD)</p><p className="text-sm font-semibold tabular mt-0.5">₹{totalNet.toLocaleString("en-IN")}</p></div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center shadow-elevated">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No payslips for {filterYear}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-lg bg-card border border-border p-3.5 flex items-center justify-between shadow-elevated">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{MONTHS[p.month - 1]} {p.year}</p>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    {p.net_salary != null && <p className="text-xs text-muted-foreground">Net: <span className="text-foreground font-medium">₹{p.net_salary.toLocaleString("en-IN")}</span></p>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(p)} disabled={downloading === p.id}>
                {downloading === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
