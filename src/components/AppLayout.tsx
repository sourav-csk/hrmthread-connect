import { NavLink, Outlet } from "react-router-dom";
import { Home, CalendarCheck, FileText, Receipt, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const baseTabs = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/attendance", icon: CalendarCheck, label: "Attendance" },
  { to: "/leaves", icon: FileText, label: "Leaves" },
  { to: "/payslip", icon: Receipt, label: "Payslip" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function AppLayout() {
  const { role } = useAuth();
  const tabs = role === "admin"
    ? [...baseTabs.slice(0, 4), { to: "/admin", icon: Shield, label: "Admin" }]
    : baseTabs;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[480px] min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-[480px] grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2 xs:py-2.5 text-[10px] xs:text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <t.icon className="h-[18px] w-[18px] xs:h-5 xs:w-5" strokeWidth={1.8} />
              <span className="leading-none">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
