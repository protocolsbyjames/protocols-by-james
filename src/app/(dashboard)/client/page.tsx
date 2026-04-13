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
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  UtensilsCrossed,
  ClipboardCheck,
  MessageSquare,
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
    .single();

  // Fetch current meal plan
  const { data: mealPlan } = await supabase
    .from("meal_plans")
    .select("id, name")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .single();

  // Fetch latest check-in with coach feedback
  const { data: latestCheckIn } = await supabase
    .from("check_ins")
    .select("id, created_at, coach_feedback(body)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const daysSinceCheckIn = latestCheckIn
    ? daysSince(latestCheckIn.created_at)
    : null;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Your Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your current programs and activity.
        </p>
      </div>

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
            <p className="text-sm text-slate-600 line-clamp-3">
              {latestCheckIn.coach_feedback[0].body}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
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
