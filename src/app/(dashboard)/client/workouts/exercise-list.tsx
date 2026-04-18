"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Check, Trash2 } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
}

interface SetLog {
  id?: string;
  set_number: number;
  weight_lbs: number | null;
  reps_completed: number | null;
  notes: string;
}

interface ExerciseListProps {
  exercises: Exercise[];
  completedIds: string[];
  userId: string;
  workoutDate?: string; // ISO date string, defaults to today
}

export function ExerciseList({
  exercises,
  completedIds: initialCompletedIds,
  userId,
  workoutDate,
}: ExerciseListProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(initialCompletedIds)
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  const today = workoutDate ?? new Date().toISOString().split("T")[0];

  // Load existing logs for all exercises on this date
  const loadLogs = useCallback(async () => {
    const exerciseIds = exercises.map((e) => e.id);
    const { data: logs } = await supabase
      .from("workout_logs")
      .select("id, exercise_id, set_number, weight_lbs, reps_completed, notes")
      .eq("client_id", userId)
      .eq("workout_date", today)
      .in("exercise_id", exerciseIds)
      .order("set_number", { ascending: true });

    if (logs && logs.length > 0) {
      const grouped: Record<string, SetLog[]> = {};
      for (const log of logs) {
        if (!grouped[log.exercise_id]) grouped[log.exercise_id] = [];
        grouped[log.exercise_id].push({
          id: log.id,
          set_number: log.set_number,
          weight_lbs: log.weight_lbs,
          reps_completed: log.reps_completed,
          notes: log.notes ?? "",
        });
      }
      setSetLogs(grouped);
    }
  }, [exercises, userId, today, supabase]);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getOrCreateSets(exercise: Exercise): SetLog[] {
    if (setLogs[exercise.id] && setLogs[exercise.id].length > 0) {
      return setLogs[exercise.id];
    }
    // Create empty set rows based on prescribed sets
    const sets: SetLog[] = [];
    for (let i = 1; i <= exercise.sets; i++) {
      sets.push({
        set_number: i,
        weight_lbs: null,
        reps_completed: null,
        notes: "",
      });
    }
    return sets;
  }

  function toggleExpand(exerciseId: string, exercise: Exercise) {
    if (expandedId === exerciseId) {
      setExpandedId(null);
    } else {
      setExpandedId(exerciseId);
      // Initialize set logs if not loaded
      if (!setLogs[exerciseId] || setLogs[exerciseId].length === 0) {
        setSetLogs((prev) => ({
          ...prev,
          [exerciseId]: getOrCreateSets(exercise),
        }));
      }
    }
  }

  function updateSet(
    exerciseId: string,
    setIndex: number,
    field: keyof SetLog,
    value: string
  ) {
    setSetLogs((prev) => {
      const sets = [...(prev[exerciseId] ?? [])];
      const set = { ...sets[setIndex] };
      if (field === "weight_lbs") {
        set.weight_lbs = value === "" ? null : parseFloat(value);
      } else if (field === "reps_completed") {
        set.reps_completed = value === "" ? null : parseInt(value, 10);
      } else if (field === "notes") {
        set.notes = value;
      }
      sets[setIndex] = set;
      return { ...prev, [exerciseId]: sets };
    });
  }

  function addSet(exerciseId: string) {
    setSetLogs((prev) => {
      const sets = [...(prev[exerciseId] ?? [])];
      const lastSet = sets[sets.length - 1];
      sets.push({
        set_number: sets.length + 1,
        weight_lbs: lastSet?.weight_lbs ?? null,
        reps_completed: null,
        notes: "",
      });
      return { ...prev, [exerciseId]: sets };
    });
  }

  function removeSet(exerciseId: string, setIndex: number) {
    setSetLogs((prev) => {
      const sets = [...(prev[exerciseId] ?? [])];
      const removed = sets.splice(setIndex, 1)[0];
      // Re-number remaining sets
      const renumbered = sets.map((s, i) => ({ ...s, set_number: i + 1 }));
      // If the removed set had an ID, delete it from DB
      if (removed.id) {
        supabase
          .from("workout_logs")
          .delete()
          .eq("id", removed.id)
          .then();
      }
      return { ...prev, [exerciseId]: renumbered };
    });
  }

  async function saveSets(exerciseId: string) {
    const sets = setLogs[exerciseId];
    if (!sets) return;

    setSaving((prev) => ({ ...prev, [exerciseId]: true }));

    // Delete existing logs for this exercise+date, then insert fresh
    await supabase
      .from("workout_logs")
      .delete()
      .eq("client_id", userId)
      .eq("exercise_id", exerciseId)
      .eq("workout_date", today);

    const rows = sets
      .filter((s) => s.weight_lbs !== null || s.reps_completed !== null)
      .map((s) => ({
        client_id: userId,
        exercise_id: exerciseId,
        workout_date: today,
        set_number: s.set_number,
        weight_lbs: s.weight_lbs,
        reps_completed: s.reps_completed,
        notes: s.notes || null,
      }));

    if (rows.length > 0) {
      await supabase.from("workout_logs").insert(rows);
    }

    // Mark as completed if any sets logged
    if (rows.length > 0 && !completedIds.has(exerciseId)) {
      setCompletedIds((prev) => new Set(prev).add(exerciseId));
      await supabase.from("exercise_completions").upsert({
        client_id: userId,
        exercise_id: exerciseId,
      });
    }

    setSaving((prev) => ({ ...prev, [exerciseId]: false }));
    setLastSaved((prev) => ({ ...prev, [exerciseId]: true }));
    setTimeout(
      () => setLastSaved((prev) => ({ ...prev, [exerciseId]: false })),
      2000
    );

    // Reload to get IDs
    await loadLogs();
  }

  const allCompleted = exercises.every((e) => completedIds.has(e.id));
  const completedCount = exercises.filter((e) => completedIds.has(e.id)).length;

  return (
    <div className="space-y-0">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            {completedCount}/{exercises.length} exercises
          </span>
          {allCompleted && (
            <span className="text-emerald-600 font-medium">Complete!</span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{
              width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {exercises.map((exercise, index) => {
        const isExpanded = expandedId === exercise.id;
        const isCompleted = completedIds.has(exercise.id);
        const sets = setLogs[exercise.id] ?? [];
        const hasLogs = sets.some(
          (s) => s.weight_lbs !== null || s.reps_completed !== null
        );

        return (
          <div key={exercise.id}>
            {index > 0 && <Separator className="my-3" />}

            {/* Exercise header — tap to expand */}
            <button
              type="button"
              onClick={() => toggleExpand(exercise.id, exercise)}
              className="flex w-full items-start gap-3 text-left"
            >
              <div className="mt-0.5 flex-shrink-0">
                {isCompleted ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    isCompleted
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {exercise.name}
                </p>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span>
                    {exercise.sets} x {exercise.reps}
                  </span>
                  {exercise.rest_seconds > 0 && (
                    <span>{exercise.rest_seconds}s rest</span>
                  )}
                  {hasLogs && !isExpanded && (
                    <span className="text-emerald-600">Logged</span>
                  )}
                </div>
                {exercise.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {exercise.notes}
                  </p>
                )}
              </div>
            </button>

            {/* Expanded: set-by-set logging */}
            {isExpanded && (
              <div className="mt-3 ml-8 space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Set</span>
                  <span>Weight (lbs)</span>
                  <span>Reps</span>
                  <span />
                </div>

                {(setLogs[exercise.id] ?? getOrCreateSets(exercise)).map(
                  (set, si) => (
                    <div
                      key={si}
                      className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center"
                    >
                      <span className="text-xs text-muted-foreground text-center">
                        {set.set_number}
                      </span>
                      <Input
                        type="number"
                        step="2.5"
                        min="0"
                        placeholder="—"
                        value={set.weight_lbs ?? ""}
                        onChange={(e) =>
                          updateSet(exercise.id, si, "weight_lbs", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="—"
                        value={set.reps_completed ?? ""}
                        onChange={(e) =>
                          updateSet(
                            exercise.id,
                            si,
                            "reps_completed",
                            e.target.value
                          )
                        }
                        className="h-8 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSet(exercise.id, si)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                )}

                {/* Add set + Save */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addSet(exercise.id)}
                    className="text-xs h-7"
                  >
                    + Add Set
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveSets(exercise.id)}
                    disabled={saving[exercise.id]}
                    className="text-xs h-7"
                  >
                    {saving[exercise.id]
                      ? "Saving..."
                      : lastSaved[exercise.id]
                        ? "Saved!"
                        : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
