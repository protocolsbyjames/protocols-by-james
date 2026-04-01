import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Plus } from "lucide-react";

export default async function CoachWorkoutsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plans } = await supabase
    .from("workout_plans")
    .select(
      "id, name, weeks, days_per_week, is_template, created_at, client_id, profiles!workout_plans_client_id_fkey(full_name)"
    )
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  const allPlans = plans ?? [];
  const templates = allPlans.filter((p) => p.is_template);
  const assigned = allPlans.filter((p) => !p.is_template && p.client_id);

  function getClientName(plan: (typeof allPlans)[number]): string | null {
    if (!plan.profiles) return null;
    const profile = Array.isArray(plan.profiles)
      ? plan.profiles[0]
      : plan.profiles;
    return profile?.full_name ?? null;
  }

  function PlanCard({ plan }: { plan: (typeof allPlans)[number] }) {
    const clientName = getClientName(plan);
    return (
      <Link href={`/coach/workouts/${plan.id}`}>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{plan.name}</CardTitle>
              {plan.is_template && (
                <Badge variant="secondary" className="text-xs">
                  Template
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 text-sm text-slate-500">
              {plan.weeks != null && <span>{plan.weeks} weeks</span>}
              {plan.days_per_week != null && (
                <span>&middot; {plan.days_per_week} days/week</span>
              )}
            </div>
            {clientName && (
              <p className="mt-2 text-sm text-slate-600">
                Assigned to{" "}
                <span className="font-medium text-slate-800">
                  {clientName}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Workout Plans
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage workout plans for your clients.
          </p>
        </div>
        <Link href="/coach/workouts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Workout Plan
          </Button>
        </Link>
      </div>

      {allPlans.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Dumbbell className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No workout plans yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create your first workout plan to get started.
          </p>
          <div className="mt-6">
            <Link href="/coach/workouts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Workout Plan
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <Tabs defaultValue={0} className="mt-8">
          <TabsList>
            <TabsTrigger value={0}>All ({allPlans.length})</TabsTrigger>
            <TabsTrigger value={1}>Templates ({templates.length})</TabsTrigger>
            <TabsTrigger value={2}>Assigned ({assigned.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={0}>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value={1}>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.length === 0 ? (
                <p className="col-span-full text-sm text-slate-500">
                  No templates yet.
                </p>
              ) : (
                templates.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value={2}>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assigned.length === 0 ? (
                <p className="col-span-full text-sm text-slate-500">
                  No assigned plans yet.
                </p>
              ) : (
                assigned.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
