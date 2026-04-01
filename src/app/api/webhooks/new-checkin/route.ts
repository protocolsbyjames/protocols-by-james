import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { record } = payload;

    if (!record) {
      return NextResponse.json({ message: "No record" }, { status: 200 });
    }

    const { data: client } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", record.client_id)
      .single();

    const { data: coach } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("role", "coach")
      .single();

    if (!coach?.email) {
      return NextResponse.json({ message: "No coach found" }, { status: 200 });
    }

    const clientName = client?.full_name || "A client";

    const { error } = await resend.emails.send({
      from: "Protocols By James <noreply@protocolsbyjames.com>",
      to: coach.email,
      subject: `New Check-In from ${clientName}`,
      html: `
        <h2>New Weekly Check-In</h2>
        <p><strong>${clientName}</strong> just submitted a check-in for week of ${record.week_of}.</p>
        <p><a href="https://app.protocolsbyjames.com/coach" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View in Dashboard</a></p>
      `,
    });

    if (error) {
      console.error("Failed to send check-in notification:", error);
      return NextResponse.json({ error: "Email failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
