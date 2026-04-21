import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Megaphone, Download, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DocRow {
  id: string;
  title: string;
  description: string | null;
  doc_type: "document" | "news";
  file_path: string | null;
  created_at: string;
}

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDocs((data ?? []) as DocRow[]);
        setLoading(false);
      });
  }, [user]);

  const news = docs.filter((d) => d.doc_type === "news");
  const documents = docs.filter((d) => d.doc_type === "document");

  const downloadDoc = async (doc: DocRow) => {
    if (!doc.file_path) return;
    try {
      const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  return (
    <div className="px-5 pt-8 space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Documents & News</h1>
        <p className="text-sm text-muted-foreground mt-1">Company announcements and files</p>
      </header>

      <Tabs defaultValue="news" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-secondary/60">
          <TabsTrigger value="news" className="text-sm">News ({news.length})</TabsTrigger>
          <TabsTrigger value="docs" className="text-sm">Documents ({documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="space-y-3 mt-4">
          {news.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No news posted yet</p>}
          {news.map((n) => (
            <div key={n.id} className="rounded-xl bg-card border border-border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">New</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{n.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{format(parseISO(n.created_at), "d MMM yyyy, HH:mm")}</p>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="docs" className="space-y-2 mt-4">
          {documents.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet</p>}
          {documents.map((d) => (
            <div key={d.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{d.title}</p>
                  {d.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{format(parseISO(d.created_at), "d MMM yyyy")}</p>
                </div>
              </div>
              {d.file_path && (
                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 flex-shrink-0" onClick={() => downloadDoc(d)}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
