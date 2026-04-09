"use client";

import {
  layoutNextLineRange,
  measureNaturalWidth,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import {
  extractUrls,
  containsInviteLink,
} from "@/lib/parse-invite-links";
import { formatMentionsForDisplay } from "@/lib/parse-mentions";
import { GROUPED_TEXT_BUBBLE_LEFT_PX } from "./chat-grouped-layout";

const FONT_FAMILY = "Arial, Helvetica, sans-serif";
const MESSAGE_FONT = `14px ${FONT_FAMILY}`;
const MESSAGE_FONT_BOLD = `600 14px ${FONT_FAMILY}`;
const MESSAGE_EDITED_FONT = `10px ${FONT_FAMILY}`;
const REPLY_FONT = `12px ${FONT_FAMILY}`;
const REPLY_FONT_BOLD = `600 12px ${FONT_FAMILY}`;

const MESSAGE_LINE_HEIGHT_PX = 20;
const REPLY_LINE_HEIGHT_PX = 16;
const GROUPED_BUBBLE_MARGIN_TOP_PX = 4;
const GROUPED_BUBBLE_HORIZONTAL_PADDING_PX = 24;
const GROUPED_BUBBLE_PADDING_TOP_BY_POSITION = {
  start: 8,
  middle: 0,
  end: 0,
} as const;
const GROUPED_BUBBLE_PADDING_BOTTOM_BY_POSITION = {
  start: 0,
  middle: 0,
  end: 8,
} as const;
const GROUPED_START_COLUMN_TOP_PADDING_PX = 2;
const GROUPED_START_HEADER_HEIGHT_PX = 26;
const GROUPED_START_HEADER_WITH_STICKER_HEIGHT_PX = 30;
const REPLY_PREVIEW_EXTRA_LEFT_PX = 12;
const REPLY_PREVIEW_GAP_BELOW_PX = 2;

const PRETEXT_MEASURE_OPTIONS = {
  whiteSpace: "pre-wrap" as const,
  wordBreak: "normal" as const,
};

type CachedPreparedText = {
  prepared: PreparedTextWithSegments;
  text: string;
};

const preparedCache = new Map<string, CachedPreparedText>();

function getPreparedText(text: string, font: string) {
  const cacheKey = `${font}::${text}`;
  const cached = preparedCache.get(cacheKey);
  if (cached) return cached.prepared;

  const prepared = prepareWithSegments(text, font, PRETEXT_MEASURE_OPTIONS);
  preparedCache.set(cacheKey, { prepared, text });
  return prepared;
}

function measureNaturalTextWidth(text: string, font: string) {
  if (!text) return 0;
  return Math.ceil(measureNaturalWidth(getPreparedText(text, font)));
}

function getVisibleMessageText(content: string) {
  return formatMentionsForDisplay(content);
}

function getReplyPreviewText({
  replyTo,
  deletedMemberLabel,
  fileLabel,
  stickerLabel,
}: {
  replyTo: {
    content: string;
    sender: { username?: string | null } | null;
    fileUrl?: string | null;
    fileName?: string | null;
    sticker?: unknown;
  };
  deletedMemberLabel: string;
  fileLabel: string;
  stickerLabel: string;
}) {
  const replyAuthor = replyTo.sender?.username || deletedMemberLabel;
  const replyContent = replyTo.sticker
    ? `🎨 ${stickerLabel}`
    : replyTo.fileUrl
      ? `📎 ${replyTo.fileName || fileLabel}`
      : getVisibleMessageText(replyTo.content).length > 50
        ? `${getVisibleMessageText(replyTo.content).substring(0, 50)}...`
        : getVisibleMessageText(replyTo.content);

  return {
    authorText: `${replyAuthor}: `,
    bodyText: replyContent,
  };
}

function isPretextCompatibleMessageText(content: string) {
  return !containsInviteLink(content) && extractUrls(content).length === 0;
}

function measurePreparedParagraph({
  text,
  font,
  lineHeightPx,
  maxWidthPx,
  firstLinePrefixWidthPx = 0,
  trailingSuffixWidthPx = 0,
}: {
  text: string;
  font: string;
  lineHeightPx: number;
  maxWidthPx: number;
  firstLinePrefixWidthPx?: number;
  trailingSuffixWidthPx?: number;
}) {
  if (!text) {
    let lineCount = 0;
    let maxLineWidth = 0;
    let lastLineWidth = 0;

    if (firstLinePrefixWidthPx > 0) {
      lineCount = 1;
      lastLineWidth = firstLinePrefixWidthPx;
      maxLineWidth = firstLinePrefixWidthPx;
    }

    if (trailingSuffixWidthPx > 0) {
      if (lineCount === 0) {
        lineCount = 1;
        lastLineWidth = trailingSuffixWidthPx;
        maxLineWidth = trailingSuffixWidthPx;
      } else if (lastLineWidth + trailingSuffixWidthPx <= maxWidthPx) {
        lastLineWidth += trailingSuffixWidthPx;
        maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
      } else {
        lineCount += 1;
        lastLineWidth = trailingSuffixWidthPx;
        maxLineWidth = Math.max(maxLineWidth, trailingSuffixWidthPx);
      }
    }

    return {
      height: lineCount * lineHeightPx,
      lineCount,
      maxLineWidth,
      lastLineWidth,
    };
  }

  const prepared = getPreparedText(text, font);
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let lineCount = 0;
  let maxLineWidth = 0;
  let lastLineWidth = 0;
  let isFirstLine = true;

  if (firstLinePrefixWidthPx >= maxWidthPx) {
    lineCount += 1;
    maxLineWidth = Math.max(maxLineWidth, firstLinePrefixWidthPx);
    lastLineWidth = firstLinePrefixWidthPx;
    isFirstLine = false;
  }

  while (true) {
    const widthForLine = Math.max(
      1,
      Math.floor(
        isFirstLine ? maxWidthPx - firstLinePrefixWidthPx : maxWidthPx,
      ),
    );
    const lineRange = layoutNextLineRange(prepared, cursor, widthForLine);
    if (!lineRange) break;

    const width =
      Math.ceil(lineRange.width) + (isFirstLine ? firstLinePrefixWidthPx : 0);
    lineCount += 1;
    maxLineWidth = Math.max(maxLineWidth, width);
    lastLineWidth = width;
    cursor = lineRange.end;
    isFirstLine = false;
  }

  if (trailingSuffixWidthPx > 0) {
    if (lineCount === 0) {
      lineCount = 1;
      maxLineWidth = trailingSuffixWidthPx;
      lastLineWidth = trailingSuffixWidthPx;
    } else if (lastLineWidth + trailingSuffixWidthPx <= maxWidthPx) {
      lastLineWidth += trailingSuffixWidthPx;
      maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
    } else {
      lineCount += 1;
      lastLineWidth = trailingSuffixWidthPx;
      maxLineWidth = Math.max(maxLineWidth, trailingSuffixWidthPx);
    }
  }

  return {
    height: lineCount * lineHeightPx,
    lineCount,
    maxLineWidth,
    lastLineWidth,
  };
}

function getGroupedHeaderHeightPx(hasBadgeSticker: boolean) {
  return hasBadgeSticker
    ? GROUPED_START_HEADER_WITH_STICKER_HEIGHT_PX
    : GROUPED_START_HEADER_HEIGHT_PX;
}

export function canUsePretextForGroupedBubbleMessage({
  content,
  deleted,
}: {
  content: string;
  deleted: boolean;
}) {
  if (deleted) return false;
  return isPretextCompatibleMessageText(content);
}

export type GroupedTextBubbleMeasurementInput = {
  content: string;
  deleted: boolean;
  isUpdated: boolean;
  position: "start" | "middle" | "end";
  showGroupedHeader: boolean;
  authorUsername?: string | null;
  authorHasBadgeSticker: boolean;
  replyTo?: {
    content: string;
    sender: { username?: string | null } | null;
    fileUrl?: string | null;
    fileName?: string | null;
    sticker?: unknown;
  } | null;
  deletedMemberLabel: string;
  fileLabel: string;
  stickerLabel: string;
  editedLabel: string;
};

export function measureGroupedTextBubbleGroup({
  items,
  contentWidthPx,
}: {
  items: GroupedTextBubbleMeasurementInput[];
  contentWidthPx: number;
}) {
  if (!items.length || contentWidthPx <= GROUPED_TEXT_BUBBLE_LEFT_PX) {
    return undefined;
  }

  const availableBubbleOuterWidthPx = Math.max(
    1,
    Math.floor(contentWidthPx - GROUPED_TEXT_BUBBLE_LEFT_PX),
  );
  const availableBubbleInnerWidthPx = Math.max(
    1,
    availableBubbleOuterWidthPx - GROUPED_BUBBLE_HORIZONTAL_PADDING_PX,
  );

  let groupWidth = 0;
  let groupTop = 0;
  let groupHeight = 0;

  items.forEach((item, index) => {
    const hasInlineUsername = item.showGroupedHeader && !item.deleted;
    const visibleContent = getVisibleMessageText(item.content);
    const usernamePrefixWidthPx = hasInlineUsername
      ? measureNaturalTextWidth(
          `${item.authorUsername || item.deletedMemberLabel}: `,
          MESSAGE_FONT_BOLD,
        )
      : 0;
    const editedSuffixWidthPx =
      item.isUpdated && !item.deleted
        ? measureNaturalTextWidth(` (${item.editedLabel})`, MESSAGE_EDITED_FONT) +
          16
        : 0;

    const messageTextMetrics = measurePreparedParagraph({
      text: visibleContent,
      font: MESSAGE_FONT,
      lineHeightPx: MESSAGE_LINE_HEIGHT_PX,
      maxWidthPx: availableBubbleInnerWidthPx,
      firstLinePrefixWidthPx: usernamePrefixWidthPx,
      trailingSuffixWidthPx: editedSuffixWidthPx,
    });

    let previewWidthPx = 0;
    let previewHeightPx = 0;
    let previewGapBelowPx = 0;

    if (item.replyTo) {
      const preview = getReplyPreviewText({
        replyTo: item.replyTo,
        deletedMemberLabel: item.deletedMemberLabel,
        fileLabel: item.fileLabel,
        stickerLabel: item.stickerLabel,
      });
      const previewAuthorWidthPx = measureNaturalTextWidth(
        preview.authorText,
        REPLY_FONT_BOLD,
      );
      const previewTextMetrics = measurePreparedParagraph({
        text: preview.bodyText,
        font: REPLY_FONT,
        lineHeightPx: REPLY_LINE_HEIGHT_PX,
        maxWidthPx: Math.max(
          1,
          availableBubbleInnerWidthPx - REPLY_PREVIEW_EXTRA_LEFT_PX,
        ),
        firstLinePrefixWidthPx: previewAuthorWidthPx,
      });
      previewWidthPx =
        previewTextMetrics.maxLineWidth + REPLY_PREVIEW_EXTRA_LEFT_PX;
      previewHeightPx = previewTextMetrics.height;
      previewGapBelowPx = REPLY_PREVIEW_GAP_BELOW_PX;
    }

    const bubbleInnerWidthPx = Math.min(
      availableBubbleInnerWidthPx,
      Math.max(messageTextMetrics.maxLineWidth, previewWidthPx),
    );
    const bubbleWidthPx = Math.min(
      availableBubbleOuterWidthPx,
      bubbleInnerWidthPx + GROUPED_BUBBLE_HORIZONTAL_PADDING_PX,
    );
    const bubbleHeightPx =
      GROUPED_BUBBLE_PADDING_TOP_BY_POSITION[item.position] +
      previewHeightPx +
      previewGapBelowPx +
      messageTextMetrics.height +
      GROUPED_BUBBLE_PADDING_BOTTOM_BY_POSITION[item.position];

    const bubbleOffsetTopWithinRowPx =
      item.showGroupedHeader
        ? GROUPED_START_COLUMN_TOP_PADDING_PX +
          getGroupedHeaderHeightPx(item.authorHasBadgeSticker) +
          GROUPED_BUBBLE_MARGIN_TOP_PX
        : GROUPED_BUBBLE_MARGIN_TOP_PX;

    groupWidth = Math.max(groupWidth, bubbleWidthPx);

    if (index === 0) {
      groupTop = bubbleOffsetTopWithinRowPx;
      groupHeight = bubbleHeightPx;
    } else {
      groupHeight += bubbleOffsetTopWithinRowPx + bubbleHeightPx;
    }
  });

  if (groupWidth <= 0 || groupHeight <= 0) return undefined;

  return {
    width: Math.ceil(groupWidth),
    left: GROUPED_TEXT_BUBBLE_LEFT_PX,
    top: Math.ceil(groupTop),
    height: Math.ceil(groupHeight),
  };
}
