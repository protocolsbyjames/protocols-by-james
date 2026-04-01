import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { record } = payload;

    if (!record || record.role !== "client") {
      return NextResponse.json({ message: "Ignored" }, { status: 200 });
    }

    const { error } = await resend.emails.send({
      from: "Protocols By James <noreply@protocolsbyjames.com>",
      to: record.email,
      subject: "Welcome to Protocols By James!",
      html: `
        <h2>Welcome, ${record.full_name}!</h2>
        <p>You've been set up on the Protocols By James coaching platform.</p>
        <p>Log in to your dashboard to view your training plan, nutrition plan, and submit weekly check-ins.</p>
        <p><a href="https://app.protocolsbyjames.com/login" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Go to Dashboard</a></p>
        <p>Let's build your best self.</p>
        <p>— James</p>
      `,
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
      return NextResponse.json({ error: "Email failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
