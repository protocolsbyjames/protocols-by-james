import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { record, type } = payload;

    if (!record) {
      return NextResponse.json({ message: "No record" }, { status: 200 });
    }

    console.log(`Subscription ${type}: client=${record.client_id}, status=${record.status}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
