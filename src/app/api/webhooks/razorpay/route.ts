import { createHmac, timingSafeEqual } from "node:crypto";
import { applyRazorpayEvent } from "@/server/actions/settings";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const body = await request.text();
  if (!secret) return new Response("Webhook secret is not configured", { status: 501 });
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return new Response("Invalid signature", { status: 400 });
  }
  const payload = JSON.parse(body) as Parameters<typeof applyRazorpayEvent>[0];
  await applyRazorpayEvent(payload);
  return Response.json({ received: true });
}
