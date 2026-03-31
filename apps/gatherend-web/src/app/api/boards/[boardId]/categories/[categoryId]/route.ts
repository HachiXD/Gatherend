// app/api/boards/[boardId]/categories/[categoryId]/route.ts

// Legacy feature flag - Categories no se usan actualmente
// pero se mantiene para futura reimplementacion.

import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  _context: { params: Promise<{ boardId: string; categoryId: string }> },
) {
  return NextResponse.json(
    { error: "Categories feature is currently disabled" },
    { status: 410 },
  );
}

export async function PATCH(
  _req: Request,
  _context: { params: Promise<{ boardId: string; categoryId: string }> },
) {
  return NextResponse.json(
    { error: "Categories feature is currently disabled" },
    { status: 410 },
  );
}