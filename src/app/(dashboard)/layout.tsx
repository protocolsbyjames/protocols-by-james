import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, type NavLink } from "@/components/dashboard/sidebar";
import {
  LayoutDashboard,
  Dumbbell,
  UtensilsCrossed,
  Settings,
  ClipboardCheck,
  TrendingUp,
  Phone,
  BookOpen,
  Link as LinkIcon,
  MessageSquare,
} from "lucide-react";

const coachLinks: NavLink[] = [
  { label: "Dashboard", href: "/coach", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Peptalks", href: "/coach/peptalks", icon: <Phone className="h-4 w-4" /> },
  { label: "Workouts", href: "/coach/workouts", icon: <Dumbbell className="h-4 w-4" /> },
  { label: "Meals", href: "/coach/meals", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { label: "Check-ins", href: "/coach/check-ins", icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: "Messages", href: "/coach/messages", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" /> },
];

const clientLinks: NavLink[] = [
  { label: "Dashboard", href: "/client", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Workouts", href: "/client/workouts", icon: <Dumbbell className="h-4 w-4" /> },
  { label: "Nutrition", href: "/client/meals", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { label: "Check-in", href: "/client/check-in", icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: "Progress", href: "/client/progress", icon: <TrendingUp className="h-4 w-4" /> },
  { label: "Messages", href: "/client/messages", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Guide", href: "/client/guide", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Resources", href: "/client/resources", icon: <LinkIcon className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" /> },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role as "coach" | "client";

  // Clients must have an active subscription to access the dashboard.
  // Coaches bypass the paywall.
  if (role === "client") {
    const { data: hasActive } = await supabase.rpc(
      "current_user_has_active_subscription",
    );
    if (hasActive !== true) {
      redirect("/onboarding");
    }
  }

  const links = role === "coach" ? coachLinks : clientLinks;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={role}
        profile={{
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }}
        links={links}
      />

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
