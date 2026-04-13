const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_BOARD_ID = "b1d51c55-bf0b-4806-a0c2-30aebb9fc80d";
const DEFAULT_COUNT = 200;
const SCRIPT_TAG = "dummy-board-member";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    boardId: DEFAULT_BOARD_ID,
    count: DEFAULT_COUNT,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--board-id" && args[i + 1]) {
      options.boardId = args[i + 1];
      i += 1;
    } else if (arg === "--count" && args[i + 1]) {
      options.count = Number(args[i + 1]);
      i += 1;
    }
  }

  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("--count must be a positive integer");
  }

  return options;
}

function dummyUserId(boardId, index) {
  return `${SCRIPT_TAG}:${boardId}:${String(index).padStart(4, "0")}`;
}

function dummyUsername(index) {
  return `dummy_member_${String(index).padStart(3, "0")}`;
}

function dummyDiscriminator(index) {
  return String(9000 + index);
}

function dummyRole(index) {
  if (index % 100 === 0) return "ADMIN";
  if (index % 25 === 0) return "MODERATOR";
  return "GUEST";
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), "..", "..", ".env"));

  const { boardId, count } = parseArgs();
  const prisma = new PrismaClient();

  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, name: true },
    });

    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }

    const indexes = Array.from({ length: count }, (_, i) => i + 1);
    const profilesData = indexes.map((index) => ({
      userId: dummyUserId(boardId, index),
      email: `dummy-board-member-${boardId}-${index}@example.invalid`,
      username: dummyUsername(index),
      discriminator: dummyDiscriminator(index),
      profileTags: ["dummy", "board-load-test"],
    }));

    const profileCreateResult = await prisma.profile.createMany({
      data: profilesData,
      skipDuplicates: true,
    });

    const profiles = await prisma.profile.findMany({
      where: {
        userId: {
          in: indexes.map((index) => dummyUserId(boardId, index)),
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    const indexByUserId = new Map(
      indexes.map((index) => [dummyUserId(boardId, index), index]),
    );

    const memberCreateResult = await prisma.member.createMany({
      data: profiles.map((profile) => {
        const index = indexByUserId.get(profile.userId);
        return {
          boardId,
          profileId: profile.id,
          role: dummyRole(index ?? 1),
          xp: (index ?? 1) * 10,
          level: Math.max(1, Math.floor((index ?? 1) / 20) + 1),
        };
      }),
      skipDuplicates: true,
    });

    const totalMembers = await prisma.member.count({
      where: { boardId },
    });

    console.log(`Board: ${board.name} (${board.id})`);
    console.log(`Requested dummy members: ${count}`);
    console.log(`New profiles created: ${profileCreateResult.count}`);
    console.log(`New members created: ${memberCreateResult.count}`);
    console.log(`Current board member count: ${totalMembers}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
