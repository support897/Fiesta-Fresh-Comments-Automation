import { NextResponse } from "next/server";

// Public VAPID key for push subscription (safe to expose)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BPKh6xq11UeVtqRAixLBwc5DVud37fhCm-H_29QcEN51bPqClYWqRvg5BRypGtSAAug73bjchAbrUiuUMPTajPg";

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}
