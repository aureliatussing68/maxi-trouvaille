import { NextResponse } from "next/server";

export function adminApiUnavailable() {
  return NextResponse.json({ error: "Admin indisponible." }, { status: 404 });
}
