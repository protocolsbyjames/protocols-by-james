"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Separator } from "@/components/ui/separator";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
}

interface ExerciseListProps {
  exercises: Exercise[];
  completedIds: string[];
  userId: string;
}

export function ExerciseList({
  exercises,
  completedIds: initialCompletedIds,
  userId,
}: ExerciseListProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(initialCompletedIds)
  );
  const supabase = createClient();

  async function toggleCompletion(exerciseId: string) {
    const isCompleted = completedIds.has(exerciseId);

    if (isCompleted) {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      await supabase
        .from("exercise_completions")
        .delete()
        .eq("client_id", userId)
        .eq("exercise_id", exerciseId);
    } else {
      setCompletedIds((prev) => new Set(prev).add(exerciseId));
      await supabase.from("exercise_completions").insert({
        client_id: userId,
        exercise_id: exerciseId,
      });
    }
  }

  return (
    <div className="space-y-0">
      {exercises.map((exercise, index) => (
        <div key={exercise.id}>
          {index > 0 && <Separator className="my-3" />}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={completedIds.has(exercise.id)}
              onChange={() => toggleCompletion(exercise.id)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  completedIds.has(exercise.id)
                    ? "text-slate-400 line-through"
                    : "text-slate-900"
                }`}
              >
                {exercise.name}
              </p>
              <div className="mt-1 flex gap-3 text-xs text-slate-500">
                <span>
                  {exercise.sets} x {exercise.reps}
                </span>
                {exercise.rest_seconds > 0 && (
                  <span>{exercise.rest_seconds}s rest</span>
                )}
              </div>
              {exercise.notes && (
                <p className="mt-1 text-xs text-slate-400">{exercise.notes}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
