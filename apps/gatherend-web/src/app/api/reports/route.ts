import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ReportCategory, ReportTargetType } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Priority calculation based on category
function calculatePriority(category: ReportCategory): string {
  switch (category) {
    case "CSAM":
      return "urgent";
    case "SEXUAL_CONTENT":
    case "HARASSMENT":
      return "high";
    case "HATE_SPEECH":
    case "IMPERSONATION":
      return "medium";
    default:
      return "low";
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting - strict for reports to prevent spam
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    // Proper authentication
    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    // Parse body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      targetType,
      targetId,
      category,
      description,
      snapshot,
      targetOwnerId,
    } = body;

    // Validate required fields
    if (!targetType || !targetId || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate targetId is a valid UUID
    if (typeof targetId !== "string" || !UUID_REGEX.test(targetId)) {
      return NextResponse.json(
        { error: "Invalid target ID format" },
        { status: 400 },
      );
    }

    // Validate targetType is valid
    if (!Object.values(ReportTargetType).includes(targetType)) {
      return NextResponse.json(
        { error: "Invalid target type" },
        { status: 400 },
      );
    }

    // Validate category is valid
    if (!Object.values(ReportCategory).includes(category)) {
      return NextResponse.json(
        { error: "Invalid report category" },
        { status: 400 },
      );
    }

    // Validate description length if provided
    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        return NextResponse.json(
          { error: "Description must be a string" },
          { status: 400 },
        );
      }
      if (description.length > 1000) {
        return NextResponse.json(
          { error: "Description must be 1000 characters or less" },
          { status: 400 },
        );
      }
    }

    // Prevent self-reporting
    if (targetOwnerId === profile.id) {
      return NextResponse.json(
        { error: "You cannot report your own content" },
        { status: 400 },
      );
    }

    // Check if user has already reported this content
    const existingReport = await db.report.findUnique({
      where: {
        reporterId_targetType_targetId: {
          reporterId: profile.id,
          targetType: targetType as ReportTargetType,
          targetId,
        },
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this content" },
        { status: 400 },
      );
    }

    // Verify the target exists based on type
    let resolvedTargetOwnerId = targetOwnerId;

    if (targetType === "MESSAGE") {
      const message = await db.message.findUnique({
        where: { id: targetId },
      });
      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      }
    } else if (targetType === "DIRECT_MESSAGE") {
      const dm = await db.directMessage.findUnique({
        where: { id: targetId },
      });
      if (!dm) {
        return NextResponse.json(
          { error: "Direct message not found" },
          { status: 404 },
        );
      }
    } else if (targetType === "BOARD") {
      const board = await db.board.findUnique({
        where: { id: targetId },
        select: { id: true, profileId: true },
      });
      if (!board) {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }
      // Use the board owner's profile ID as targetOwnerId
      resolvedTargetOwnerId = board.profileId;

      // Prevent self-reporting own board
      if (board.profileId === profile.id) {
        return NextResponse.json(
          { error: "You cannot report your own board" },
          { status: 400 },
        );
      }
    } else if (targetType === "COMMUNITY_POST") {
      const post = await db.communityPost.findUnique({
        where: { id: targetId },
        select: { id: true, authorProfileId: true, deleted: true },
      });
      if (!post || post.deleted) {
        return NextResponse.json(
          { error: "Community post not found" },
          { status: 404 },
        );
      }

      resolvedTargetOwnerId = post.authorProfileId;

      if (post.authorProfileId === profile.id) {
        return NextResponse.json(
          { error: "You cannot report your own post" },
          { status: 400 },
        );
      }
    } else if (targetType === "COMMUNITY_POST_COMMENT") {
      const comment = await db.communityPostComment.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          authorProfileId: true,
          deleted: true,
          post: {
            select: {
              deleted: true,
            },
          },
        },
      });
      if (!comment || comment.deleted || comment.post.deleted) {
        return NextResponse.json(
          { error: "Community post comment not found" },
          { status: 404 },
        );
      }

      resolvedTargetOwnerId = comment.authorProfileId;

      if (comment.authorProfileId === profile.id) {
        return NextResponse.json(
          { error: "You cannot report your own comment" },
          { status: 400 },
        );
      }
    } else if (targetType === "PROFILE") {
      const targetProfile = await db.profile.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!targetProfile) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 },
        );
      }
      // The target owner is the profile itself
      resolvedTargetOwnerId = targetId;

      // Prevent self-reporting
      if (targetId === profile.id) {
        return NextResponse.json(
          { error: "You cannot report yourself" },
          { status: 400 },
        );
      }
    }

    // Calculate priority based on category
    const priority = calculatePriority(category as ReportCategory);

    // Create the report
    const report = await db.report.create({
      data: {
        reporterId: profile.id,
        targetType: targetType as ReportTargetType,
        targetId,
        targetOwnerId: resolvedTargetOwnerId || null,
        category: category as ReportCategory,
        description: description || null,
        snapshot: snapshot || {},
        priority,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: "Report submitted successfully",
    });
  } catch (error) {
    console.error("[REPORTS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
