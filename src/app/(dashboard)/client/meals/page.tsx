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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lock, ArrowRight, UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { FoodSuggestions } from "./food-suggestions";
import { MealLogger } from "./meal-logger";

const MEAL_TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

function mealTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default async function ClientMealsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check which program the client is on
  const { data: workoutPlan } = await supabase
    .from("workout_plans")
    .select("name")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planName = workoutPlan?.name?.toLowerCase() ?? "";
  const isShred = planName.includes("shred");

  // Fetch intake for personalized targets
  const { data: intake } = await supabase
    .from("client_intake_submissions")
    .select("current_weight_kg")
    .eq("profile_id", user.id)
    .maybeSingle();

  const weightLbs = intake?.current_weight_kg
    ? Math.round(intake.current_weight_kg * 2.205)
    : null;

  // Determine if this is a coaching client (has a coaching subscription)
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, coaching_plans(plan_type)")
    .eq("client_id", user.id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const coachingPlanData = subscription?.coaching_plans as
    | { plan_type: string }
    | { plan_type: string }[]
    | null;
  const planType = Array.isArray(coachingPlanData)
    ? coachingPlanData[0]?.plan_type ?? null
    : coachingPlanData?.plan_type ?? null;
  const isCoachingClient = planType === "coaching";

  // Try to load a custom meal plan (coaching clients)
  const { data: plan } = await supabase
    .from("meal_plans")
    .select(
      "id, name, description, meals(id, meal_type, name, description, calories, protein_g, carbs_g, fat_g)"
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Nutrition
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCoachingClient
            ? "Your custom meal plan, meal logger, and food suggestions."
            : isShred
              ? "What to eat to get lean while keeping your muscle."
              : "What to eat to fuel muscle growth and recovery."}
        </p>
      </div>

      {/* Custom meal plan for coaching clients */}
      {plan && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {plan.name}
            </h2>
            {plan.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {plan.description}
              </p>
            )}

            {(() => {
              const meals = plan.meals ?? [];
              const grouped = MEAL_TYPE_ORDER.map((type) => ({
                type,
                label: mealTypeLabel(type),
                meals: meals.filter((m) => m.meal_type === type),
              })).filter((group) => group.meals.length > 0);

              const totalCalories = meals.reduce(
                (sum, m) => sum + (m.calories ?? 0),
                0
              );
              const totalProtein = meals.reduce(
                (sum, m) => sum + (m.protein_g ?? 0),
                0
              );
              const totalCarbs = meals.reduce(
                (sum, m) => sum + (m.carbs_g ?? 0),
                0
              );
              const totalFat = meals.reduce(
                (sum, m) => sum + (m.fat_g ?? 0),
                0
              );

              return (
                <>
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-base">Daily Totals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            {totalCalories}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Calories
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">
                            {totalProtein}g
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Protein
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-600">
                            {totalCarbs}g
                          </p>
                          <p className="text-xs text-muted-foreground">Carbs</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-rose-600">
                            {totalFat}g
                          </p>
                          <p className="text-xs text-muted-foreground">Fat</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4 mb-6">
                    {grouped.map((group) => (
                      <Card key={group.type}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {group.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {group.meals.map((meal) => (
                              <div
                                key={meal.id}
                                className="rounded-lg border border-border bg-background p-4"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {meal.name}
                                    </p>
                                    {meal.description && (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {meal.description}
                                      </p>
                                    )}
                                  </div>
                                  {meal.calories != null &&
                                    meal.calories > 0 && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {meal.calories} cal
                                      </Badge>
                                    )}
                                </div>
                                <div className="mt-3 flex gap-4">
                                  <span className="text-xs text-blue-600">
                                    P: {meal.protein_g ?? 0}g
                                  </span>
                                  <span className="text-xs text-amber-600">
                                    C: {meal.carbs_g ?? 0}g
                                  </span>
                                  <span className="text-xs text-rose-600">
                                    F: {meal.fat_g ?? 0}g
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
          <Separator className="my-8" />
        </>
      )}

      {/* Meal Logger — coaching clients get full access, self-guided get locked CTA */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Meal Logger
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {isCoachingClient
            ? "Track what you eat so your coach can review and optimize your nutrition."
            : "Log your meals and track your macros throughout the day."}
        </p>

        {isCoachingClient ? (
          <MealLogger userId={user.id} />
        ) : (
          <Card className="border-border bg-muted/30 relative overflow-hidden">
            <div className="absolute inset-0 backdrop-blur-[2px] bg-background/60 z-10 flex flex-col items-center justify-center p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground text-lg">
                Unlock Meal Logging & Custom Meal Plans
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Coaching clients get a personalized meal plan built around their
                goals, plus full meal logging with macro tracking that their
                coach reviews weekly.
              </p>
              <Link
                href="https://protocolsbyjames.com/coaching#pricing"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-4"
                )}
              >
                Upgrade to Coaching <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
            {/* Blurred preview behind the lock */}
            <CardContent className="py-6 opacity-40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  <div className="h-8 w-8 rounded bg-muted" />
                  <span className="text-sm font-medium">Today</span>
                  <div className="h-8 w-8 rounded bg-muted" />
                </div>
                <div className="h-8 w-20 rounded bg-muted" />
              </div>
              <div className="grid grid-cols-4 gap-3 text-center mb-4">
                {["1,850", "165g", "210g", "52g"].map((v) => (
                  <div key={v} className="rounded-lg border border-border p-2">
                    <p className="text-lg font-bold">{v}</p>
                    <p className="text-[10px] text-muted-foreground">—</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {["Breakfast: 4 eggs, oats, banana", "Pre-Workout: Protein shake, rice cakes", "Lunch: Chicken breast, rice, broccoli"].map((m) => (
                  <div key={m} className="rounded-lg border border-border p-3">
                    <p className="text-sm">{m}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator className="my-8" />

      {/* Food suggestions — everyone gets this */}
      <FoodSuggestions isShred={isShred} weightLbs={weightLbs} />
    </div>
  );
}
