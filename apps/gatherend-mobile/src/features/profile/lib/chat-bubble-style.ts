import { z } from "zod";

const HEX_COLOR_REGEX = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

/** Used only as initial value in the editor UI, not as a saved default. */
export const EDITOR_DEFAULT_CHAT_BUBBLE_STYLE = {
  background: null,
  borderWidth: 0,
  shadowEnabled: false,
  roundedEnabled: true,
} as const;

export const chatBubbleStyleSchema = z
  .object({
    background: z
      .string()
      .regex(HEX_COLOR_REGEX, "Background must be a valid hex color")
      .nullable(),
    borderWidth: z
      .number()
      .int("Border width must be an integer")
      .min(0, "Border width must be between 0 and 5")
      .max(5, "Border width must be between 0 and 5"),
    shadowEnabled: z.boolean(),
    roundedEnabled: z.boolean(),
  })
  .strict();

export const nullableChatBubbleStyleSchema = chatBubbleStyleSchema.nullable();

export type ChatBubbleStyle = z.infer<typeof chatBubbleStyleSchema>;

/**
 * Returns null when value is null/undefined/invalid.
 * Only returns a ChatBubbleStyle when the stored value is a valid object.
 */
export function normalizeChatBubbleStyle(value: unknown): ChatBubbleStyle | null {
  if (value === null || value === undefined) return null;
  const parsed = chatBubbleStyleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
