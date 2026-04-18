"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface MealLog {
  id: string;
  meal_type: string;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "lunch", label: "Lunch" },
  { value: "post_workout", label: "Post-Workout" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
] as const;

function mealTypeLabel(type: string) {
  return MEAL_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface MealLoggerProps {
  userId: string;
  initialDate?: string;
}

export function MealLogger({ userId, initialDate }: MealLoggerProps) {
  const supabase = createClient();
  const [logDate, setLogDate] = useState(
    initialDate ?? new Date().toISOString().split("T")[0]
  );
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New meal form state
  const [mealType, setMealType] = useState("breakfast");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const isToday = logDate === today;

  const loadMeals = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("meal_logs")
      .select("id, meal_type, description, calories, protein_g, carbs_g, fat_g")
      .eq("client_id", userId)
      .eq("log_date", logDate)
      .order("created_at", { ascending: true });
    setMeals(data ?? []);
    setLoading(false);
  }, [userId, logDate, supabase]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  function navigateDate(offset: number) {
    const d = new Date(logDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setLogDate(d.toISOString().split("T")[0]);
  }

  function formatDate(dateStr: string) {
    if (dateStr === today) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function resetForm() {
    setMealType("breakfast");
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setShowForm(false);
  }

  async function handleSave() {
    if (!description.trim()) return;
    setSaving(true);

    await supabase.from("meal_logs").insert({
      client_id: userId,
      log_date: logDate,
      meal_type: mealType,
      description: description.trim(),
      calories: calories ? parseInt(calories) : null,
      protein_g: protein ? parseInt(protein) : null,
      carbs_g: carbs ? parseInt(carbs) : null,
      fat_g: fat ? parseInt(fat) : null,
    });

    setSaving(false);
    resetForm();
    await loadMeals();
  }

  async function handleDelete(id: string) {
    await supabase.from("meal_logs").delete().eq("id", id);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }

  // Daily totals
  const totalCal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalP = meals.reduce((s, m) => s + (m.protein_g ?? 0), 0);
  const totalC = meals.reduce((s, m) => s + (m.carbs_g ?? 0), 0);
  const totalF = meals.reduce((s, m) => s + (m.fat_g ?? 0), 0);

  // Group by meal type
  const grouped = MEAL_TYPES.map((t) => ({
    ...t,
    meals: meals.filter((m) => m.meal_type === t.value),
  })).filter((g) => g.meals.length > 0);

  return (
    <div className="space-y-4">
      {/* Date nav + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateDate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[5rem] text-center">
            {formatDate(logDate)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateDate(1)}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-1" /> Log Meal
        </Button>
      </div>

      {/* Daily totals */}
      {meals.length > 0 && (
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="rounded-lg border border-border p-2">
            <p className="text-lg font-bold text-foreground">{totalCal}</p>
            <p className="text-[10px] text-muted-foreground">Calories</p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-lg font-bold text-blue-600">{totalP}g</p>
            <p className="text-[10px] text-muted-foreground">Protein</p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-lg font-bold text-amber-600">{totalC}g</p>
            <p className="text-[10px] text-muted-foreground">Carbs</p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-lg font-bold text-rose-600">{totalF}g</p>
            <p className="text-[10px] text-muted-foreground">Fat</p>
          </div>
        </div>
      )}

      {/* Add meal form */}
      {showForm && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log a Meal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mealType" className="text-xs">Meal</Label>
              <select
                id="mealType"
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs">What did you eat?</Label>
              <Textarea
                id="desc"
                placeholder="e.g. 6oz chicken breast, 1 cup rice, steamed broccoli"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Calories</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Protein (g)</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Carbs (g)</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Fat (g)</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving || !description.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logged meals */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
      ) : meals.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10">
          <p className="text-sm text-muted-foreground">No meals logged for this day.</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Log your first meal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.value}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{meal.description}</p>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        {meal.calories != null && <span>{meal.calories} cal</span>}
                        {meal.protein_g != null && (
                          <span className="text-blue-600">P: {meal.protein_g}g</span>
                        )}
                        {meal.carbs_g != null && (
                          <span className="text-amber-600">C: {meal.carbs_g}g</span>
                        )}
                        {meal.fat_g != null && (
                          <span className="text-rose-600">F: {meal.fat_g}g</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(meal.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors mt-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
