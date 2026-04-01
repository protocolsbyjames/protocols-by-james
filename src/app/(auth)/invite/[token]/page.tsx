"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InviteData {
  id: string;
  token: string;
  coach: {
    full_name: string | null;
  } | null;
}

function parseInvite(data: Record<string, unknown>): InviteData {
  const coach = Array.isArray(data.coach) ? data.coach[0] ?? null : data.coach ?? null;
  return {
    id: data.id as string,
    token: data.token as string,
    coach: coach as InviteData["coach"],
  };
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvite() {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("invites")
        .select("id, token, coach:profiles!invites_coach_id_fkey(full_name)")
        .eq("token", params.token)
        .is("accepted_by", null)
        .single();

      if (fetchError || !data) {
        setError(
          "This invite link is invalid or has already been used."
        );
      } else {
        setInvite(parseInvite(data as unknown as Record<string, unknown>));
      }

      setLoading(false);
    }

    loadInvite();
  }, [params.token]);

  function handleJoin() {
    router.push(`/signup?invite=${params.token}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading invite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coachName = invite?.coach?.full_name ?? "A coach";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Protocols By James
          </h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coaching Invitation</CardTitle>
            <CardDescription>
              {coachName} has invited you to join as a client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleJoin} className="w-full" size="lg">
              Join as Client
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
