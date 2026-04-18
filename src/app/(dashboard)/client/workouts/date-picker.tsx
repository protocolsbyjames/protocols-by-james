"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkoutDatePickerProps {
  currentDate: string; // ISO date string YYYY-MM-DD
}

export function WorkoutDatePicker({ currentDate }: WorkoutDatePickerProps) {
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];
  const isToday = currentDate === today;

  function navigate(offset: number) {
    const d = new Date(currentDate + "T12:00:00"); // noon to avoid timezone issues
    d.setDate(d.getDate() + offset);
    const next = d.toISOString().split("T")[0];
    router.push(`/client/workouts?date=${next}`);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    if (isToday) return "Today";

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[5rem] text-center">
        {formatDate(currentDate)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(1)}
        disabled={isToday}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
