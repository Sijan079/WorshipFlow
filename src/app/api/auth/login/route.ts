import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Use Supabase Auth email sign-in." }, { status: 410 });
}
