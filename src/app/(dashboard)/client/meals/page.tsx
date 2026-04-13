import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed } from "lucide-react";

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

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, name, description, meals(id, meal_type, name, description, calories, protein_g, carbs_g, fat_g)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My Meals
        </h1>
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <UtensilsCrossed className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No meal plan assigned
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your coach hasn&apos;t assigned a meal plan yet.
          </p>
        </div>
      </div>
    );
  }

  const meals = plan.meals ?? [];

  // Group meals by type
  const grouped = MEAL_TYPE_ORDER.map((type) => ({
    type,
    label: mealTypeLabel(type),
    meals: meals.filter((m) => m.meal_type === type),
  })).filter((group) => group.meals.length > 0);

  // Calculate daily totals
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const totalProtein = meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0);
  const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs_g ?? 0), 0);
  const totalFat = meals.reduce((sum, m) => sum + (m.fat_g ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My Meals
        </h1>
        <p className="mt-1 text-sm text-slate-500">{plan.name}</p>
        {plan.description && (
          <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
        )}
      </div>

      {/* Daily Totals */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Daily Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {totalCalories}
              </p>
              <p className="text-xs text-slate-500">Calories</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {totalProtein}g
              </p>
              <p className="text-xs text-slate-500">Protein</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {totalCarbs}g
              </p>
              <p className="text-xs text-slate-500">Carbs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{totalFat}g</p>
              <p className="text-xs text-slate-500">Fat</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meals by Type */}
      <div className="space-y-4">
        {grouped.map((group) => (
          <Card key={group.type}>
            <CardHeader>
              <CardTitle className="text-base">{group.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {group.meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {meal.name}
                        </p>
                        {meal.description && (
                          <p className="mt-1 text-xs text-slate-500">
                            {meal.description}
                          </p>
                        )}
                      </div>
                      {meal.calories != null && meal.calories > 0 && (
                        <Badge variant="secondary" className="text-xs">
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

        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No meals have been added to this plan yet.
          </p>
        )}
      </div>
    </div>
  );
}
