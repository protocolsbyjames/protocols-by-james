"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HeartRateCalculator() {
  const [age, setAge] = useState("");

  const ageNum = age ? parseInt(age) : null;
  const maxHR = ageNum && ageNum > 0 && ageNum < 120 ? 220 - ageNum : null;
  const zoneLow = maxHR ? Math.round(maxHR * 0.6) : null;
  const zoneHigh = maxHR ? Math.round(maxHR * 0.7) : null;

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1.5 flex-1 max-w-[140px]">
          <Label htmlFor="hr-age" className="text-xs font-medium">
            Your age
          </Label>
          <Input
            id="hr-age"
            type="number"
            placeholder="e.g. 25"
            min={10}
            max={100}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="h-9"
          />
        </div>
        {maxHR && (
          <div className="pb-1">
            <p className="text-xs text-muted-foreground">
              Max HR: <span className="font-medium text-foreground">{maxHR} BPM</span>
            </p>
          </div>
        )}
      </div>

      {maxHR && zoneLow && zoneHigh ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Your Zone 2 Range
          </p>
          <p className="text-3xl font-bold text-emerald-700">
            {zoneLow}&ndash;{zoneHigh} <span className="text-lg font-normal">BPM</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Stay in this range during your cardio sessions.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Enter your age to see your personalized Zone 2 heart rate range.
          </p>
        </div>
      )}
    </div>
  );
}
