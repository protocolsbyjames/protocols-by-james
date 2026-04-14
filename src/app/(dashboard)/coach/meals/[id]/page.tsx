"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

interface Meal {
  id?: string;
  meal_type: MealType;
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface PlanForm {
  name: string;
  description: string;
  is_template: boolean;
  client_id: string | null;
}

interface Client {
  id: string;
  full_name: string | null;
}

function mealTypeLabel(type: MealType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function MealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledClientId = searchParams.get("client");
  const supabase = createClient();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<PlanForm>({
    name: "",
    description: "",
    is_template: !prefilledClientId,
    client_id: prefilledClientId,
  });
  const [meals, setMeals] = useState<Meal[]>([]);

  const fetchPlan = useCallback(async () => {
    if (isNew) return;
    setLoading(true);

    const { data: plan } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (plan) {
      setForm({
        name: plan.name ?? "",
        description: plan.description ?? "",
        is_template: plan.is_template ?? true,
        client_id: plan.client_id ?? null,
      });

      const { data: mealRows } = await supabase
        .from("meals")
        .select("*")
        .eq("plan_id", id)
        .order("meal_type");

      if (mealRows) {
        setMeals(
          mealRows.map((m) => ({
            id: m.id,
            meal_type: m.meal_type as MealType,
            name: m.name ?? "",
            description: m.description ?? "",
            calories: m.calories ?? 0,
            protein_g: m.protein_g ?? 0,
            carbs_g: m.carbs_g ?? 0,
            fat_g: m.fat_g ?? 0,
          }))
        );
      }
    }

    setLoading(false);
  }, [isNew, id, supabase]);

  const fetchClients = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("coach_id", user.id)
      .eq("role", "client")
      .order("full_name");

    setClients(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchPlan();
    fetchClients();
  }, [fetchPlan, fetchClients]);

  function updateForm(field: keyof PlanForm, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addMeal(mealType: MealType) {
    setMeals((prev) => [
      ...prev,
      {
        meal_type: mealType,
        name: "",
        description: "",
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
    ]);
  }

  function removeMeal(index: number) {
    setMeals((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMeal(index: number, field: keyof Meal, value: unknown) {
    setMeals((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function getMealsForType(type: MealType) {
    return meals
      .map((m, index) => ({ ...m, originalIndex: index }))
      .filter((m) => m.meal_type === type);
  }

  async function handleSave() {
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const planPayload = {
        name: form.name,
        description: form.description,
        is_template: form.is_template,
        client_id: form.client_id || null,
        coach_id: user.id,
      };

      let planId = id;

      if (isNew) {
        const { data, error } = await supabase
          .from("meal_plans")
          .insert(planPayload)
          .select("id")
          .single();
        if (error) throw error;
        planId = data.id;
      } else {
        const { error } = await supabase
          .from("meal_plans")
          .update(planPayload)
          .eq("id", id);
        if (error) throw error;

        // Delete existing meals to rebuild
        await supabase.from("meals").delete().eq("plan_id", id);
      }

      // Insert meals
      if (meals.length > 0) {
        const mealRows = meals.map((m) => ({
          plan_id: planId,
          meal_type: m.meal_type,
          name: m.name,
          description: m.description,
          calories: m.calories,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
        }));

        const { error } = await supabase.from("meals").insert(mealRows);
        if (error) throw error;
      }

      router.push("/coach/meals");
    } catch (error) {
      console.error("Failed to save meal plan:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/coach/meals")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isNew ? "Create Meal Plan" : "Edit Meal Plan"}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
            <CardDescription>
              Set the basic information for this meal plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g. High Protein Cutting Plan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Describe the goals and guidelines of this meal plan..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="is_template"
                type="checkbox"
                checked={form.is_template}
                onChange={(e) => updateForm("is_template", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <Label htmlFor="is_template">Save as template</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Assign to Client</Label>
              <select
                id="client"
                value={form.client_id ?? ""}
                onChange={(e) =>
                  updateForm("client_id", e.target.value || null)
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No client (template only)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name ?? "Unnamed Client"}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Meals by Type */}
        {MEAL_TYPES.map((type) => {
          const typeMeals = getMealsForType(type);
          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{mealTypeLabel(type)}</CardTitle>
                    <CardDescription>
                      {typeMeals.length} item{typeMeals.length !== 1 && "s"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addMeal(type)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add {mealTypeLabel(type)}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeMeals.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">
                    No {type} items added yet.
                  </p>
                )}

                {typeMeals.map((meal) => (
                  <div
                    key={meal.originalIndex}
                    className="rounded-md border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Meal Name</Label>
                          <Input
                            value={meal.name}
                            onChange={(e) =>
                              updateMeal(
                                meal.originalIndex,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="e.g. Grilled Chicken Salad"
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={meal.description}
                            onChange={(e) =>
                              updateMeal(
                                meal.originalIndex,
                                "description",
                                e.target.value
                              )
                            }
                            placeholder="Optional description..."
                            className="h-8"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-8 w-8"
                        onClick={() => removeMeal(meal.originalIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Calories</Label>
                        <Input
                          type="number"
                          min={0}
                          value={meal.calories}
                          onChange={(e) =>
                            updateMeal(
                              meal.originalIndex,
                              "calories",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Protein (g)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={meal.protein_g}
                          onChange={(e) =>
                            updateMeal(
                              meal.originalIndex,
                              "protein_g",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Carbs (g)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={meal.carbs_g}
                          onChange={(e) =>
                            updateMeal(
                              meal.originalIndex,
                              "carbs_g",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fat (g)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={meal.fat_g}
                          onChange={(e) =>
                            updateMeal(
                              meal.originalIndex,
                              "fat_g",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <Separator />

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/coach/meals")}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
