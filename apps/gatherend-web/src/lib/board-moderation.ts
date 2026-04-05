import {
  BoardBanSourceType,
  BoardModerationActionType,
  BoardWarningStatus,
  type Prisma,
} from "@prisma/client";

export const BOARD_WARNING_THRESHOLD = 3;

type Tx = Prisma.TransactionClient;

async function removeBoardMembershipArtifacts(
  tx: Tx,
  input: {
    boardId: string;
    profileId: string;
    memberId?: string | null;
  },
) {
  const memberId =
    input.memberId ??
    (
      await tx.member.findFirst({
        where: {
          boardId: input.boardId,
          profileId: input.profileId,
        },
        select: {
          id: true,
        },
      })
    )?.id;

  if (!memberId) {
    return false;
  }

  await tx.channelMember.deleteMany({
    where: {
      profileId: input.profileId,
      channel: { boardId: input.boardId },
    },
  });

  await tx.channelReadState.deleteMany({
    where: {
      profileId: input.profileId,
      channel: { boardId: input.boardId },
    },
  });

  await tx.mention.deleteMany({
    where: {
      profileId: input.profileId,
      message: {
        channel: { boardId: input.boardId },
      },
    },
  });

  await tx.member.delete({
    where: { id: memberId },
  });

  return true;
}

export async function issueBoardBan(
  tx: Tx,
  input: {
    boardId: string;
    profileId: string;
    issuedById: string;
    sourceType: BoardBanSourceType;
    memberId?: string | null;
  },
) {
  const existingBan = await tx.boardBan.findUnique({
    where: {
      boardId_profileId: {
        boardId: input.boardId,
        profileId: input.profileId,
      },
    },
    select: {
      id: true,
      sourceType: true,
    },
  });

  if (
    existingBan &&
    existingBan.sourceType === BoardBanSourceType.MANUAL &&
    input.sourceType === BoardBanSourceType.WARNING_THRESHOLD
  ) {
    return {
      banId: existingBan.id,
      membershipRemoved: false,
      skipped: true,
    };
  }

  const membershipRemoved = await removeBoardMembershipArtifacts(tx, {
    boardId: input.boardId,
    profileId: input.profileId,
    memberId: input.memberId,
  });

  const ban = existingBan
    ? await tx.boardBan.update({
        where: { id: existingBan.id },
        data: {
          issuedById: input.issuedById,
          sourceType: input.sourceType,
        },
        select: {
          id: true,
          sourceType: true,
        },
      })
    : await tx.boardBan.create({
        data: {
          boardId: input.boardId,
          profileId: input.profileId,
          issuedById: input.issuedById,
          sourceType: input.sourceType,
        },
        select: {
          id: true,
          sourceType: true,
        },
      });

  await tx.boardModerationAction.create({
    data: {
      boardId: input.boardId,
      profileId: input.profileId,
      issuedById: input.issuedById,
      actionType:
        input.sourceType === BoardBanSourceType.MANUAL
          ? BoardModerationActionType.BAN
          : BoardModerationActionType.AUTO_BAN,
      banId: ban.id,
    },
  });

  return {
    banId: ban.id,
    membershipRemoved,
    skipped: false,
  };
}

async function promoteBoardWarningsToBan(
  tx: Tx,
  input: {
    boardId: string;
    profileId: string;
    issuedById: string;
  },
) {
  const existingBan = await tx.boardBan.findUnique({
    where: {
      boardId_profileId: {
        boardId: input.boardId,
        profileId: input.profileId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingBan) {
    return {
      autoBanId: existingBan.id,
      membershipRemoved: false,
      autoBanned: false,
    };
  }

  const activeWarnings = await tx.boardWarning.findMany({
    where: {
      boardId: input.boardId,
      profileId: input.profileId,
      status: BoardWarningStatus.ACTIVE,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: BOARD_WARNING_THRESHOLD,
    select: {
      id: true,
    },
  });

  if (activeWarnings.length < BOARD_WARNING_THRESHOLD) {
    return {
      autoBanId: null,
      membershipRemoved: false,
      autoBanned: false,
    };
  }

  const warningIds = activeWarnings.map((warning) => warning.id);
  const membership = await tx.member.findFirst({
    where: {
      boardId: input.boardId,
      profileId: input.profileId,
    },
    select: {
      id: true,
    },
  });

  const banResult = await issueBoardBan(tx, {
    boardId: input.boardId,
    profileId: input.profileId,
    issuedById: input.issuedById,
    sourceType: BoardBanSourceType.WARNING_THRESHOLD,
    memberId: membership?.id ?? null,
  });

  if (banResult.skipped || !banResult.banId) {
    return {
      autoBanId: banResult.banId,
      membershipRemoved: banResult.membershipRemoved,
      autoBanned: false,
    };
  }

  await tx.boardWarning.updateMany({
    where: {
      id: { in: warningIds },
    },
    data: {
      status: BoardWarningStatus.PROMOTED,
      promotedToBanId: banResult.banId,
      removedAt: null,
      removedById: null,
    },
  });

  return {
    autoBanId: banResult.banId,
    membershipRemoved: banResult.membershipRemoved,
    autoBanned: true,
  };
}

export async function issueBoardWarning(
  tx: Tx,
  input: {
    boardId: string;
    profileId: string;
    issuedById: string;
  },
) {
  const existingBan = await tx.boardBan.findUnique({
    where: {
      boardId_profileId: {
        boardId: input.boardId,
        profileId: input.profileId,
      },
    },
    select: { id: true },
  });

  if (existingBan) {
    throw new Error("TARGET_ALREADY_BANNED");
  }

  const warning = await tx.boardWarning.create({
    data: {
      boardId: input.boardId,
      profileId: input.profileId,
      issuedById: input.issuedById,
      status: BoardWarningStatus.ACTIVE,
    },
    select: {
      id: true,
      boardId: true,
      profileId: true,
      issuedById: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      removedAt: true,
    },
  });

  await tx.boardModerationAction.create({
    data: {
      boardId: input.boardId,
      profileId: input.profileId,
      issuedById: input.issuedById,
      actionType: BoardModerationActionType.WARNING,
      warningId: warning.id,
    },
  });

  const promotionResult = await promoteBoardWarningsToBan(tx, input);

  return {
    warning,
    ...promotionResult,
  };
}

export async function removeBoardWarning(
  tx: Tx,
  input: {
    boardId: string;
    warningId: string;
    issuedById: string;
  },
) {
  const warning = await tx.boardWarning.findUnique({
    where: { id: input.warningId },
    select: {
      id: true,
      boardId: true,
      profileId: true,
      status: true,
      promotedToBanId: true,
    },
  });

  if (!warning || warning.boardId !== input.boardId) {
    throw new Error("WARNING_NOT_FOUND");
  }

  if (warning.status === BoardWarningStatus.REMOVED) {
    throw new Error("WARNING_ALREADY_REMOVED");
  }

  await tx.boardModerationAction.create({
    data: {
      boardId: input.boardId,
      profileId: warning.profileId,
      issuedById: input.issuedById,
      actionType: BoardModerationActionType.REMOVE_WARNING,
      warningId: warning.id,
    },
  });

  if (warning.status === BoardWarningStatus.ACTIVE) {
    await tx.boardWarning.update({
      where: { id: warning.id },
      data: {
        status: BoardWarningStatus.REMOVED,
        removedAt: new Date(),
        removedById: input.issuedById,
      },
    });

    return {
      warningRemoved: true,
      autoUnbanned: false,
      autoBanned: false,
      membershipRemoved: false,
      affectedProfileId: warning.profileId,
    };
  }

  const promotedBanId = warning.promotedToBanId;
  const promotedBan = promotedBanId
    ? await tx.boardBan.findUnique({
        where: { id: promotedBanId },
        select: {
          id: true,
          sourceType: true,
          profileId: true,
        },
      })
    : null;

  const siblingWarnings = promotedBanId
    ? await tx.boardWarning.findMany({
        where: {
          promotedToBanId: promotedBanId,
          status: BoardWarningStatus.PROMOTED,
          NOT: { id: warning.id },
        },
        select: { id: true },
      })
    : [];

  await tx.boardWarning.update({
    where: { id: warning.id },
    data: {
      status: BoardWarningStatus.REMOVED,
      removedAt: new Date(),
      removedById: input.issuedById,
      promotedToBanId: null,
    },
  });

  if (siblingWarnings.length > 0) {
    await tx.boardWarning.updateMany({
      where: {
        id: { in: siblingWarnings.map((warningItem) => warningItem.id) },
      },
      data: {
        status: BoardWarningStatus.ACTIVE,
        promotedToBanId: null,
      },
    });
  }

  let autoUnbanned = false;

  if (
    promotedBan &&
    promotedBan.sourceType === BoardBanSourceType.WARNING_THRESHOLD
  ) {
    await tx.boardModerationAction.create({
      data: {
        boardId: input.boardId,
        profileId: promotedBan.profileId,
        issuedById: input.issuedById,
        actionType: BoardModerationActionType.AUTO_UNBAN,
        banId: promotedBan.id,
      },
    });

    await tx.boardBan.delete({
      where: { id: promotedBan.id },
    });

    autoUnbanned = true;
  }

  const rePromotionResult = await promoteBoardWarningsToBan(tx, {
    boardId: input.boardId,
    profileId: warning.profileId,
    issuedById: input.issuedById,
  });

  return {
    warningRemoved: true,
    autoUnbanned,
    autoBanned: rePromotionResult.autoBanned,
    membershipRemoved: rePromotionResult.membershipRemoved,
    affectedProfileId: warning.profileId,
  };
}

export async function removeBoardBan(
  tx: Tx,
  input: {
    boardId: string;
    profileId: string;
    issuedById: string;
  },
) {
  const ban = await tx.boardBan.findUnique({
    where: {
      boardId_profileId: {
        boardId: input.boardId,
        profileId: input.profileId,
      },
    },
    select: {
      id: true,
      sourceType: true,
      profileId: true,
    },
  });

  if (!ban) {
    throw new Error("NOT_BANNED");
  }

  await tx.boardModerationAction.create({
    data: {
      boardId: input.boardId,
      profileId: ban.profileId,
      issuedById: input.issuedById,
      actionType: BoardModerationActionType.UNBAN,
      banId: ban.id,
    },
  });

  await tx.boardBan.delete({
    where: {
      boardId_profileId: {
        boardId: input.boardId,
        profileId: input.profileId,
      },
    },
  });

  return ban;
}

export async function kickBoardMember(
  tx: Tx,
  input: {
    boardId: string;
    profileId: string;
    issuedById: string;
    memberId: string;
  },
) {
  await removeBoardMembershipArtifacts(tx, {
    boardId: input.boardId,
    profileId: input.profileId,
    memberId: input.memberId,
  });

  await tx.boardModerationAction.create({
    data: {
      boardId: input.boardId,
      profileId: input.profileId,
      issuedById: input.issuedById,
      actionType: BoardModerationActionType.KICK,
    },
  });

  return {
    kickedProfileId: input.profileId,
  };
}
