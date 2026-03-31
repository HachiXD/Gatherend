// app/api/boards/[boardId]/categories/route.ts

// Legacy feature flag - Categories no se usan actualmente
// pero se mantiene para futura reimplementacion.

import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  _context: { params: Promise<{ boardId: string }> },
) {
  return NextResponse.json(
    { error: "Categories feature is currently disabled" },
    { status: 410 },
  );
}