"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CoachFeedbackFormProps {
  checkInId: string;
  existingFeedback: string | null;
  feedbackId: string | null;
}

export function CoachFeedbackForm({
  checkInId,
  existingFeedback,
  feedbackId,
}: CoachFeedbackFormProps) {
  const [feedback, setFeedback] = useState(existingFeedback ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      if (feedbackId) {
        const { error: updateError } = await supabase
          .from("coach_feedback")
          .update({ body: feedback, updated_at: new Date().toISOString() })
          .eq("id", feedbackId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("coach_feedback")
          .insert({
            check_in_id: checkInId,
            coach_id: user.id,
            body: feedback,
          });
        if (insertError) throw insertError;
      }

      setSaved(true);
    } catch (err) {
      console.error("Failed to save feedback:", err);
      setError("Failed to save feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coach Feedback</CardTitle>
        <CardDescription>
          {existingFeedback
            ? "Update your feedback for this check-in."
            : "Write feedback for the client on this check-in."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existingFeedback && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-600">Current Feedback</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {existingFeedback}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Great progress this week! Here are some thoughts..."
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              setSaved(false);
            }}
            rows={5}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Feedback saved successfully.
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !feedback.trim()}>
              {submitting
                ? "Saving..."
                : existingFeedback
                  ? "Update Feedback"
                  : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
