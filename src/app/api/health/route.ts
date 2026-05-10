import { NextResponse } from "next/server";

/**
 * Santé applicative minimale (load balancer, uptime, smoke tests).
 * Ne dépend pas de la base ni des clés tierces.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "leadpartner", ts: new Date().toISOString() },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
