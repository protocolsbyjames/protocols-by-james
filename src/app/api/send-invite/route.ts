import { Resend } from "resend";
import { NextResponse } from "next/server";
const resend = new Resend(process.env.RESEND_API_KEY);
export async function POST(request: Request) {
  try {
    const { email, token } = await request.json();
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${token}`;
    const { error } = await resend.emails.send({
      from: "Protocols By James <noreply@protocolsbyjames.com>",
      to: email,
      subject: "You've been invited to Protocols By James",
      html: `
        <h2>You've been invited!</h2>
        <p>A coach has invited you to join Protocols By James.</p>
        <p><a href="${inviteUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Accept Invitation</a></p>
        <p>Or copy this link: ${inviteUrl}</p>
      `,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
