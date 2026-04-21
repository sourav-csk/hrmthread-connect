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
import { Loader2, Plus, Wallet, Clock, CheckCircle2, XCircle, Upload, AlertCircle, IndianRupee } from "lucide-react";
import { format, parseISO } from "date-fns";

type ReimbStatus = "pending" | "approved" | "rejected" | "paid";

interface ReimbRow {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  receipt_url: string | null;
  status: ReimbStatus;
  reviewer_notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<ReimbStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const CATEGORIES = ["Travel", "Food & Meals", "Office Supplies", "Medical", "Training", "Software", "Other"];

export default function Reimbursements() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReimbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [category, setCategory] = useState("Travel");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reimbursements")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as ReimbRow[]);
        setLoading(false);
      });
  }, [user]);

  const resetForm = () => {
    setCategory("Travel");
    setAmount("");
    setExpenseDate("");
    setDescription("");
    setReceiptFile(null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!amount || !expenseDate || !category) {
      toast.error("Please fill in all required fields");
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile, { upsert: true });
        if (upErr) throw upErr;
        receiptUrl = path;
      }

      const { data, error } = await supabase.from("reimbursements").insert({
        user_id: user.id,
        category,
        amount: parsedAmount,
        expense_date: expenseDate,
        description: description.trim() || null,
        receipt_url: receiptUrl,
      }).select().single();

      if (error) throw error;
      setItems((prev) => [data as ReimbRow, ...prev]);
      toast.success("Reimbursement claim submitted");
      resetForm();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit");
    }
    setSubmitting(false);
  };

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");
  const pendingTotal = pending.reduce((s, i) => s + i.amount, 0);
  const paidTotal = items.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="px-5 pt-8 space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reimbursements</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit & track expense claims</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-accent text-primary-foreground font-semibold h-10 px-4">
              <Plus className="h-4 w-4" /> Claim
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>New Expense Claim</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Expense details..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Receipt (optional)</Label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-secondary/30 cursor-pointer hover:border-primary/40 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{receiptFile ? receiptFile.name : "Upload receipt image or PDF"}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full gradient-accent text-primary-foreground font-semibold"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Claim
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Summary */}
      <div className="rounded-2xl gradient-card border border-border p-5 shadow-elevated">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending claims</p>
            <p className="text-2xl font-bold tabular">₹{pendingTotal.toLocaleString("en-IN")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Total claimed</p>
            <p className="text-sm font-semibold tabular mt-0.5">₹{items.reduce((s, i) => s + i.amount, 0).toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total paid</p>
            <p className="text-sm font-semibold tabular mt-0.5 text-primary">₹{paidTotal.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-secondary/60">
          <TabsTrigger value="pending" className="text-sm">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="resolved" className="text-sm">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 mt-4">
          {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pending claims</p>}
          {pending.map((r) => <ReimbCard key={r.id} item={r} />)}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-2 mt-4">
          {resolved.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No resolved claims</p>}
          {resolved.map((r) => <ReimbCard key={r.id} item={r} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReimbCard({ item }: { item: ReimbRow }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">{item.category}</p>
            <p className="text-xs text-muted-foreground">{format(parseISO(item.expense_date), "d MMM yyyy")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular">₹{item.amount.toLocaleString("en-IN")}</p>
          <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold mt-1 ${STATUS_COLORS[item.status]}`}>
            {item.status}
          </Badge>
        </div>
      </div>
      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
      {item.reviewer_notes && (
        <div className="rounded-lg bg-secondary/50 p-2.5 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{item.reviewer_notes}</p>
        </div>
      )}
    </div>
  );
}
