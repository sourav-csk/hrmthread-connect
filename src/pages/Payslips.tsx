import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Receipt, IndianRupee, FileText } from "lucide-react";
import { toast } from "sonner";

interface Payslip {
  id: string;
  month: number;
  year: number;
  gross_salary: number | null;
  net_salary: number | null;
  file_path: string;
  created_at: string;
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
    supabase
      .from("payslips")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .then(({ data }) => {
        setPayslips((data ?? []) as Payslip[]);
        setLoading(false);
      });
  }, [user]);

  const years = [...new Set(payslips.map((p) => p.year))].sort((a, b) => b - a);
  const filtered = payslips.filter((p) => String(p.year) === filterYear);

  const totalGross = filtered.reduce((s, p) => s + (p.gross_salary ?? 0), 0);
  const totalNet = filtered.reduce((s, p) => s + (p.net_salary ?? 0), 0);

  const handleDownload = async (payslip: Payslip) => {
    setDownloading(payslip.id);
    try {
      const { data, error } = await supabase.storage.from("payslips").download(payslip.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${MONTHS[payslip.month - 1]}-${payslip.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    }
    setDownloading(null);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="px-5 pt-8 space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Payslips</h1>
        <p className="text-sm text-muted-foreground mt-1">View and download your salary slips</p>
      </header>

      {/* Summary */}
      <div className="rounded-2xl gradient-card border border-border p-5 shadow-elevated">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Year earnings</p>
            <p className="text-2xl font-bold tabular">₹{totalNet.toLocaleString("en-IN")}</p>
          </div>
          {years.length > 0 && (
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {totalGross > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Gross (YTD)</p>
              <p className="text-sm font-semibold tabular mt-0.5">₹{totalGross.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net (YTD)</p>
              <p className="text-sm font-semibold tabular mt-0.5">₹{totalNet.toLocaleString("en-IN")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Payslip list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No payslips available for {filterYear}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{MONTHS[p.month - 1]} {p.year}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {p.gross_salary != null && (
                      <p className="text-xs text-muted-foreground">Gross: <span className="text-foreground/80">₹{p.gross_salary.toLocaleString("en-IN")}</span></p>
                    )}
                    {p.net_salary != null && (
                      <p className="text-xs text-muted-foreground">Net: <span className="text-primary font-medium">₹{p.net_salary.toLocaleString("en-IN")}</span></p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary hover:bg-primary/10"
                onClick={() => handleDownload(p)}
                disabled={downloading === p.id}
              >
                {downloading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
