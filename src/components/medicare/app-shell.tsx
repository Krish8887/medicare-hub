"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  FileHeart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  type LucideIcon,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/medicare-api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMedicareStore, type MedicareView } from "@/lib/medicare-store";
import { cn } from "@/lib/utils";
import DashboardView from "./dashboard-view";
import UserDashboardView from "./user-dashboard-view";
import ProfileView from "./profile-view";
import MyAppointmentsView from "./my-appointments-view";
import AppointmentsView from "./appointments-view";
import SlotsView from "./slots-view";
import DoctorsView from "./doctors-view";
import PatientsView from "./patients-view";
import RecordsView from "./records-view";
import BillingView from "./billing-view";
import DepartmentsView from "./departments-view";
import ArticlesView from "./articles-view";

const NAV_ITEMS: {
  view: MedicareView;
  label: string;
  icon: LucideIcon;
  /** Hidden from MEMBER (role "USER") accounts — admin workspace sections. */
  adminOnly?: boolean;
  /** Hidden from ADMIN accounts — personal member sections. */
  memberOnly?: boolean;
}[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "my-appointments", label: "My Appointments", icon: CalendarCheck, memberOnly: true },
  { view: "appointments", label: "Appointments", icon: CalendarDays, adminOnly: true },
  { view: "slots", label: "Appointment Slots", icon: CalendarClock, adminOnly: true },
  { view: "doctors", label: "Doctors", icon: Stethoscope, adminOnly: true },
  { view: "patients", label: "Patients", icon: Users, adminOnly: true },
  { view: "records", label: "Medical Records", icon: FileHeart, adminOnly: true },
  { view: "billing", label: "Billing & Invoices", icon: ReceiptText, adminOnly: true },
  { view: "departments", label: "Departments", icon: Building2, adminOnly: true },
  { view: "articles", label: "Health Tips", icon: BookOpen },
  { view: "profile", label: "My Profile", icon: UserRound },
];

/** Views a MEMBER account may open (everything else falls back to their dashboard). */
const MEMBER_ALLOWED = new Set<MedicareView>([
  "dashboard",
  "my-appointments",
  "articles",
  "profile",
]);

const VIEW_META: Record<MedicareView, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your hospital at a glance" },
  "my-appointments": {
    title: "My Appointments",
    subtitle: "Request visits from open slots and track their approval",
  },
  appointments: { title: "Appointments", subtitle: "Approve requests and manage patient visits" },
  slots: { title: "Appointment Slots", subtitle: "Publish the bookable times members can request" },
  doctors: { title: "Doctors", subtitle: "Manage your medical specialists" },
  patients: { title: "Patients", subtitle: "Patient directory and profiles" },
  records: { title: "Medical Records", subtitle: "Diagnoses, prescriptions and treatment history" },
  billing: { title: "Billing & Invoices", subtitle: "Invoices, payments and revenue" },
  departments: { title: "Departments", subtitle: "Organize hospital departments" },
  articles: { title: "Health Tips", subtitle: "Published wellness articles and guides" },
  profile: { title: "My Profile", subtitle: "Account details, display name and password" },
};

/** Member accounts get a personalized header for their dashboard. */
const MEMBER_DASHBOARD_META = {
  title: "My Health",
  subtitle: "Your appointments, records and invoices in one place",
};

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <HeartPulse className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-bold leading-tight">Medicare Hub</p>
        <p className="truncate text-xs text-muted-foreground">Healthcare Management</p>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onSelect: (view: MedicareView) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.view)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function SidebarNav({
  onSelect,
  isAdmin,
}: {
  onSelect: (view: MedicareView) => void;
  isAdmin: boolean;
}) {
  const activeView = useMedicareStore((s) => s.activeView);
  const items = NAV_ITEMS.filter((item) =>
    isAdmin ? !item.memberOnly : !item.adminOnly
  );
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
      {items.map((item) => (
        <NavButton
          key={item.view}
          item={item}
          active={activeView === item.view}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}

export default function AppShell() {
  const activeView = useMedicareStore((s) => s.activeView);
  const setActiveView = useMedicareStore((s) => s.setActiveView);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { toast } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  // Members can only be on dashboard / articles / profile — anything else
  // (e.g. a stale activeView) falls back to their personal dashboard.
  const effectiveView: MedicareView =
    isAdmin || MEMBER_ALLOWED.has(activeView) ? activeView : "dashboard";
  const meta =
    !isAdmin && effectiveView === "dashboard" ? MEMBER_DASHBOARD_META : VIEW_META[effectiveView];
  const todayLabel = format(new Date(), "EEEE, MMM d, yyyy");
  const year = new Date().getFullYear();

  const handleSelect = (view: MedicareView) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  const handleSignOut = () => {
    toast({
      title: "Signed out",
      description: "You have been safely signed out.",
    });
    setActiveView("dashboard");
    void signOut();
  };

  const renderView = () => {
    switch (effectiveView) {
      case "dashboard":
        // Admins get the hospital-wide dashboard; members get My Health.
        return isAdmin ? <DashboardView /> : <UserDashboardView />;
      case "profile":
        return <ProfileView />;
      case "my-appointments":
        return <MyAppointmentsView />;
      case "appointments":
        return <AppointmentsView />;
      case "slots":
        return <SlotsView />;
      case "doctors":
        return <DoctorsView />;
      case "patients":
        return <PatientsView />;
      case "records":
        return <RecordsView />;
      case "billing":
        return <BillingView />;
      case "departments":
        return <DepartmentsView />;
      case "articles":
        return <ArticlesView />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
          <div className="border-b px-6 py-5">
            <BrandMark />
          </div>
          <SidebarNav onSelect={setActiveView} isAdmin={isAdmin} />
          <div className="border-t p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {getInitials(user?.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium leading-tight">
                        {user?.name ?? "Account"}
                      </span>
                      {isAdmin && (
                        <ShieldCheck
                          className="h-3.5 w-3.5 shrink-0 text-primary"
                          aria-label="Administrator"
                        />
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </span>
                  <LogOut
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-60">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    {isAdmin ? (
                      <>
                        <ShieldCheck className="h-3 w-3 text-primary" aria-hidden="true" />
                        Administrator account
                      </>
                    ) : (
                      <>
                        <UserRound className="h-3 w-3 text-primary" aria-hidden="true" />
                        Member account
                      </>
                    )}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveView("profile")}>
                  <UserRound aria-hidden="true" />
                  My profile
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  <LogOut aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Right column: header + main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            {/* Mobile nav */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b p-5">
                  <SheetTitle className="flex items-center gap-3 text-left text-base font-bold">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                      <HeartPulse className="h-5 w-5" aria-hidden="true" />
                    </span>
                    Medicare Hub
                  </SheetTitle>
                  <SheetDescription className="text-left">Healthcare Management</SheetDescription>
                </SheetHeader>
                <SidebarNav onSelect={handleSelect} isAdmin={isAdmin} />
                <div className="mt-auto border-t p-3">
                  <div className="mb-2 flex items-center gap-3 px-1">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {getInitials(user?.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">
                        {user?.name ?? "Account"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {isAdmin ? "Administrator" : "Member"} · {user?.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight md:text-lg">
                {meta.title}
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {meta.subtitle}
              </p>
            </div>

            {!isAdmin && (
              <Badge
                className="hidden shrink-0 border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-400 sm:inline-flex"
              >
                <UserRound className="h-3 w-3" aria-hidden="true" />
                Member
              </Badge>
            )}

            <p className="hidden shrink-0 text-sm text-muted-foreground sm:block" aria-label="Today's date">
              {todayLabel}
            </p>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <motion.div
                key={effectiveView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {renderView()}
              </motion.div>
            </div>
          </main>
        </div>
      </div>

      <footer className="mt-auto border-t py-4">
        <p className="text-center text-sm text-muted-foreground">
          © {year} Medicare Hub. Compassionate care, powered by technology.
        </p>
      </footer>
    </div>
  );
}
