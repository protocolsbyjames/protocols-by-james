import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Verify the user is a coach
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 },
      );
    }

    if (profile.role !== "coach") {
      return NextResponse.json(
        { error: "Only coaches can create invites" },
        { status: 403 },
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 },
      );
    }

    const token = randomUUID();

    const { error: insertError } = await supabase.from("invites").insert({
      coach_id: user.id,
      email,
      token,
    });

    if (insertError) {
      console.error("Failed to create invite:", insertError);
      return NextResponse.json(
        { error: "Failed to create invite" },
        { status: 500 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const inviteUrl = `${appUrl}/invite/${token}`;

    return NextResponse.json({ token, inviteUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Invite creation failed:", message);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}
