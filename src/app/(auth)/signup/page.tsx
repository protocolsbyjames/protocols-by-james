"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"coach" | "client">(
    inviteToken ? "client" : "coach"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteCoachName, setInviteCoachName] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;

    async function lookupInvite() {
      const supabase = createClient();
      const { data: invite } = await supabase
        .from("invites")
        .select("*, coach:profiles!invites_coach_id_fkey(full_name)")
        .eq("token", inviteToken)
        .single();

      const coach = Array.isArray(invite?.coach)
        ? invite.coach[0]
        : invite?.coach;
      if (coach?.full_name) {
        setInviteCoachName(coach.full_name);
      }
    }

    lookupInvite();
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("An unexpected error occurred. Please try again.");
        setLoading(false);
        return;
      }

      // Create profile row
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      // If signing up via invite, accept the invite
      if (inviteToken) {
        await supabase
          .from("invites")
          .update({
            status: "accepted",
            accepted_by: data.user.id,
            accepted_at: new Date().toISOString(),
          })
          .eq("token", inviteToken);
      }

      // Redirect based on role
      if (role === "coach") {
        router.push("/coach");
      } else {
        router.push("/client");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Protocols By James
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your account to get started
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              {inviteCoachName
                ? `You've been invited by ${inviteCoachName}`
                : "Choose your role and fill in your details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>I am a</Label>
                <Tabs
                  value={role}
                  onValueChange={(value) =>
                    setRole(value as "coach" | "client")
                  }
                >
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="coach"
                      className="flex-1"
                      disabled={!!inviteToken}
                    >
                      Coach
                    </TabsTrigger>
                    <TabsTrigger value="client" className="flex-1">
                      Client
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="coach" />
                  <TabsContent value="client" />
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                size="lg"
              >
                {loading
                  ? "Creating account..."
                  : `Sign up as ${role === "coach" ? "Coach" : "Client"}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignupPageContent />
    </Suspense>
  );
}
