import { Construction } from "lucide-react";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 pt-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </header>
      <div className="rounded-2xl gradient-card border border-border p-10 text-center shadow-elevated">
        <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <Construction className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Coming up next</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          This module will be built in the next phase. Database, auth and design system are already wired up and ready.
        </p>
      </div>
    </div>
  );
}
