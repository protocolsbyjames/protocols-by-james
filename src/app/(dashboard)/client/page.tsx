import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  UtensilsCrossed,
  ClipboardCheck,
  MessageSquare,
  BookOpen,
  ArrowRight,
} from "lucide-react";

function daysSince(date: string): number {
  const then = new Date(date);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ClientDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch current workout plan
  const { data: workoutPlan } = await supabase
    .from("workout_plans")
    .select("id, name")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  // Fetch current meal plan
  const { data: mealPlan } = await supabase
    .from("meal_plans")
    .select("id, name")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  // Fetch latest check-in with coach feedback
  const { data: latestCheckIn } = await supabase
    .from("check_ins")
    .select("id, created_at, coach_feedback(body)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check if this is a brand-new client (no workout logs yet)
  const { count: logCount } = await supabase
    .from("workout_logs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id);

  const isNewClient = (logCount ?? 0) === 0 && !latestCheckIn;

  const daysSinceCheckIn = latestCheckIn
    ? daysSince(latestCheckIn.created_at)
    : null;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your current programs and activity.
        </p>
      </div>

      {/* Welcome banner for new clients */}
      {isNewClient && workoutPlan && (
        <Card className="mt-6 border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 flex-shrink-0">
              <BookOpen className="h-6 w-6 text-emerald-700" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Welcome to {workoutPlan.name}!
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Read your program guide before your first session — it covers
                how to train, eat, and track your progress.
              </p>
            </div>
            <Link
              href="/client/guide"
              className={cn(
                buttonVariants({ size: "sm" }),
                "flex-shrink-0"
              )}
            >
              Read Guide <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Dumbbell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardDescription>Current Workout Plan</CardDescription>
              <CardTitle className="text-base">
                {workoutPlan?.name ?? "No active plan"}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <UtensilsCrossed className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardDescription>Current Meal Plan</CardDescription>
              <CardTitle className="text-base">
                {mealPlan?.name ?? "No active plan"}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardDescription>Last Check-in</CardDescription>
              <CardTitle className="text-base">
                {daysSinceCheckIn !== null
                  ? daysSinceCheckIn === 0
                    ? "Today"
                    : `${daysSinceCheckIn} day${daysSinceCheckIn === 1 ? "" : "s"} ago`
                  : "No check-ins yet"}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Coach feedback preview */}
      {latestCheckIn?.coach_feedback?.[0]?.body && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardDescription>Coach Feedback</CardDescription>
              <CardTitle className="text-base">Latest Check-in Review</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {latestCheckIn.coach_feedback[0].body}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Quick Actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/client/check-in" className={cn(buttonVariants())}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Submit Check-in
          </Link>
          <Link href="/client/workouts" className={cn(buttonVariants({ variant: "outline" }))}>
            <Dumbbell className="mr-2 h-4 w-4" />
            View Workouts
          </Link>
          <Link href="/client/meals" className={cn(buttonVariants({ variant: "outline" }))}>
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            View Meals
          </Link>
        </div>
      </div>
    </div>
  );
}
