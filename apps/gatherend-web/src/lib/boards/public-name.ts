import { Prisma } from "@prisma/client";

export const PUBLIC_BOARD_NAME_CONFLICT_ERROR = "PUBLIC_BOARD_NAME_CONFLICT";
export const PUBLIC_BOARD_NAME_UNIQUE_INDEX = "board_public_name_unique";

type BoardQueryClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
};

export function normalizePublicBoardName(name: string) {
  return name.trim().toLowerCase();
}

export async function findPublicBoardNameConflict(
  client: BoardQueryClient,
  name: string,
  excludeBoardId?: string,
) {
  const normalizedName = normalizePublicBoardName(name);

  const rows = await client.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name"
    FROM "Board"
    WHERE NOT "isPrivate"
      AND lower(btrim("name")) = ${normalizedName}
      ${excludeBoardId
        ? Prisma.sql`AND "id" <> ${excludeBoardId}`
        : Prisma.empty}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function ensurePublicBoardNameAvailable(
  client: BoardQueryClient,
  options: {
    name: string;
    isPrivate: boolean;
    excludeBoardId?: string;
  },
) {
  if (options.isPrivate) {
    return;
  }

  const conflict = await findPublicBoardNameConflict(
    client,
    options.name,
    options.excludeBoardId,
  );

  if (conflict) {
    throw new Error(PUBLIC_BOARD_NAME_CONFLICT_ERROR);
  }
}

export function isPublicBoardNameUniqueConstraintError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.some((value) =>
      String(value).includes(PUBLIC_BOARD_NAME_UNIQUE_INDEX),
    );
  }

  if (typeof target === "string") {
    return target.includes(PUBLIC_BOARD_NAME_UNIQUE_INDEX);
  }

  return error.message.includes(PUBLIC_BOARD_NAME_UNIQUE_INDEX);
}
