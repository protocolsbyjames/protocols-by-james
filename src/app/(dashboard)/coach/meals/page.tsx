import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UtensilsCrossed, Plus } from "lucide-react";

export default async function CoachMealsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plans } = await supabase
    .from("meal_plans")
    .select(
      "id, name, is_template, created_at, client_id, profiles!meal_plans_client_id_fkey(full_name)"
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
      <Link href={`/coach/meals/${plan.id}`}>
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
            {clientName && (
              <p className="text-sm text-muted-foreground">
                Assigned to{" "}
                <span className="font-medium text-foreground">
                  {clientName}
                </span>
              </p>
            )}
            {!clientName && !plan.is_template && (
              <p className="text-sm text-muted-foreground">Unassigned</p>
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Meal Plans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage meal plans for your clients.
          </p>
        </div>
        <Link href="/coach/meals/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Meal Plan
          </Button>
        </Link>
      </div>

      {allPlans.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <UtensilsCrossed className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No meal plans yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first meal plan to get started.
          </p>
          <div className="mt-6">
            <Link href="/coach/meals/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Meal Plan
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
                <p className="col-span-full text-sm text-muted-foreground">
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
                <p className="col-span-full text-sm text-muted-foreground">
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
