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
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
} from "lucide-react";

interface Exercise {
  id?: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
  sort_order: number;
}

interface WorkoutDay {
  id?: string;
  day_number: number;
  name: string;
  exercises: Exercise[];
  expanded: boolean;
}

interface PlanForm {
  name: string;
  description: string;
  weeks: number;
  days_per_week: number;
  is_template: boolean;
  client_id: string | null;
}

interface Client {
  id: string;
  full_name: string | null;
}

export default function WorkoutPlanPage({
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
    weeks: 4,
    days_per_week: 3,
    is_template: !prefilledClientId,
    client_id: prefilledClientId,
  });
  const [days, setDays] = useState<WorkoutDay[]>([]);

  const fetchPlan = useCallback(async () => {
    if (isNew) return;
    setLoading(true);

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (plan) {
      setForm({
        name: plan.name ?? "",
        description: plan.description ?? "",
        weeks: plan.weeks ?? 4,
        days_per_week: plan.days_per_week ?? 3,
        is_template: plan.is_template ?? true,
        client_id: plan.client_id ?? null,
      });

      const { data: dayRows } = await supabase
        .from("workout_days")
        .select("*, exercises(*)")
        .eq("plan_id", id)
        .order("day_number");

      if (dayRows) {
        setDays(
          dayRows.map((d) => ({
            id: d.id,
            day_number: d.day_number,
            name: d.name ?? `Day ${d.day_number}`,
            expanded: false,
            exercises: (d.exercises ?? [])
              .sort(
                (a: { sort_order: number }, b: { sort_order: number }) =>
                  a.sort_order - b.sort_order
              )
              .map((e: Record<string, unknown>) => ({
                id: e.id as string,
                name: (e.name as string) ?? "",
                sets: (e.sets as number) ?? 3,
                reps: String(e.reps ?? "10"),
                rest_seconds: (e.rest_seconds as number) ?? 60,
                notes: (e.notes as string) ?? "",
                sort_order: (e.sort_order as number) ?? 0,
              })),
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

  function addDay() {
    const nextNumber = days.length > 0 ? Math.max(...days.map((d) => d.day_number)) + 1 : 1;
    setDays((prev) => [
      ...prev,
      {
        day_number: nextNumber,
        name: `Day ${nextNumber}`,
        exercises: [],
        expanded: true,
      },
    ]);
  }

  function removeDay(index: number) {
    setDays((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleDay(index: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, expanded: !d.expanded } : d))
    );
  }

  function updateDay(index: number, field: keyof WorkoutDay, value: unknown) {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  }

  function addExercise(dayIndex: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                {
                  name: "",
                  sets: 3,
                  reps: "10",
                  rest_seconds: 60,
                  notes: "",
                  sort_order: d.exercises.length,
                },
              ],
            }
          : d
      )
    );
  }

  function removeExercise(dayIndex: number, exerciseIndex: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              exercises: d.exercises.filter((_, ei) => ei !== exerciseIndex),
            }
          : d
      )
    );
  }

  function updateExercise(
    dayIndex: number,
    exerciseIndex: number,
    field: keyof Exercise,
    value: unknown
  ) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              exercises: d.exercises.map((e, ei) =>
                ei === exerciseIndex ? { ...e, [field]: value } : e
              ),
            }
          : d
      )
    );
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
        weeks: form.weeks,
        days_per_week: form.days_per_week,
        is_template: form.is_template,
        client_id: form.client_id || null,
        coach_id: user.id,
      };

      let planId = id;

      if (isNew) {
        const { data, error } = await supabase
          .from("workout_plans")
          .insert(planPayload)
          .select("id")
          .single();
        if (error) throw error;
        planId = data.id;
      } else {
        const { error } = await supabase
          .from("workout_plans")
          .update(planPayload)
          .eq("id", id);
        if (error) throw error;

        // Delete existing days and exercises to rebuild
        await supabase.from("workout_days").delete().eq("plan_id", id);
      }

      // Insert days and exercises
      for (const day of days) {
        const { data: dayData, error: dayError } = await supabase
          .from("workout_days")
          .insert({
            plan_id: planId,
            day_number: day.day_number,
            name: day.name,
          })
          .select("id")
          .single();

        if (dayError) throw dayError;

        if (day.exercises.length > 0) {
          const exerciseRows = day.exercises.map((ex, idx) => ({
            day_id: dayData.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            sort_order: idx,
          }));

          const { error: exError } = await supabase
            .from("exercises")
            .insert(exerciseRows);
          if (exError) throw exError;
        }
      }

      router.push("/coach/workouts");
    } catch (error) {
      console.error("Failed to save workout plan:", error);
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
          onClick={() => router.push("/coach/workouts")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isNew ? "Create Workout Plan" : "Edit Workout Plan"}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
            <CardDescription>
              Set the basic information for this workout plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g. 12-Week Strength Program"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Describe the goals and structure of this plan..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weeks">Weeks</Label>
                <Input
                  id="weeks"
                  type="number"
                  min={1}
                  value={form.weeks}
                  onChange={(e) =>
                    updateForm("weeks", parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_per_week">Days per Week</Label>
                <Input
                  id="days_per_week"
                  type="number"
                  min={1}
                  max={7}
                  value={form.days_per_week}
                  onChange={(e) =>
                    updateForm(
                      "days_per_week",
                      parseInt(e.target.value) || 1
                    )
                  }
                />
              </div>
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

        {/* Workout Days */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workout Days</CardTitle>
                <CardDescription>
                  Add training days and exercises for each day.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addDay}>
                <Plus className="mr-2 h-4 w-4" />
                Add Day
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {days.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No days added yet. Click &quot;Add Day&quot; to get started.
              </p>
            )}

            {days.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className="rounded-lg border border-slate-200"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3"
                  onClick={() => toggleDay(dayIndex)}
                >
                  <div className="flex items-center gap-3">
                    {day.expanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <Input
                      value={day.name}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateDay(dayIndex, "name", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-48 font-medium"
                    />
                    <span className="text-xs text-slate-400">
                      {day.exercises.length} exercise
                      {day.exercises.length !== 1 && "s"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDay(dayIndex);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>

                {day.expanded && (
                  <div className="border-t border-slate-200 px-4 py-4">
                    <div className="space-y-3">
                      {day.exercises.map((exercise, exIndex) => (
                        <div
                          key={exIndex}
                          className="rounded-md border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-5">
                            <div className="sm:col-span-2">
                              <Label className="text-xs">Exercise Name</Label>
                              <Input
                                value={exercise.name}
                                onChange={(e) =>
                                  updateExercise(
                                    dayIndex,
                                    exIndex,
                                    "name",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Barbell Squat"
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Sets</Label>
                              <Input
                                type="number"
                                min={1}
                                value={exercise.sets}
                                onChange={(e) =>
                                  updateExercise(
                                    dayIndex,
                                    exIndex,
                                    "sets",
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Reps</Label>
                              <Input
                                value={exercise.reps}
                                onChange={(e) =>
                                  updateExercise(
                                    dayIndex,
                                    exIndex,
                                    "reps",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. 8-12"
                                className="mt-1 h-8"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Rest (s)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={exercise.rest_seconds}
                                  onChange={(e) =>
                                    updateExercise(
                                      dayIndex,
                                      exIndex,
                                      "rest_seconds",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="mt-1 h-8"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  removeExercise(dayIndex, exIndex)
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              value={exercise.notes}
                              onChange={(e) =>
                                updateExercise(
                                  dayIndex,
                                  exIndex,
                                  "notes",
                                  e.target.value
                                )
                              }
                              placeholder="Optional notes..."
                              className="mt-1 h-8"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => addExercise(dayIndex)}
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Add Exercise
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/coach/workouts")}
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
