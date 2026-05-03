import { z } from "zod";

const HEX_COLOR_REGEX = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalNullableString(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const optionalHexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, "Color must be a valid hex value");

const requiredContentSchema = z
  .string()
  .trim()
  .min(1, "Content is required")
  .max(280, "Content must be 280 characters or less");

const optionalTitleSchema = z.preprocess(
  normalizeOptionalNullableString,
  z.string().trim().min(1).max(10).nullable().optional(),
);

const requiredSectionTitleSchema = z.preprocess(
  normalizeOptionalString,
  z.string().trim().min(1).max(10),
);

const optionalPageTitleSchema = z.preprocess(
  normalizeOptionalNullableString,
  z.string().trim().min(1).max(40).nullable().optional(),
);

const leftTopTextSchema = z
  .object({
    title: optionalTitleSchema,
    content: requiredContentSchema,
  })
  .strict();

const textSectionSchema = z
  .object({
    title: requiredSectionTitleSchema,
    content: requiredContentSchema,
  })
  .strict();

const leftBottomTextSchema = z
  .object({
    sectionA: textSectionSchema.optional(),
    sectionB: textSectionSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sectionA && !value.sectionB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "leftBottomText must include at least one populated section",
      });
    }
  });

const imageMetaSchema = z
  .object({
    title: optionalTitleSchema,
  })
  .strict();

export const profileCardConfigSchema = z
  .object({
    version: z.literal(1),
    style: z
      .object({
        backgroundColor: optionalHexColorSchema,
        boxColor: optionalHexColorSchema,
        rounded: z.boolean(),
        shadows: z.boolean(),
      })
      .strict(),
    content: z
      .object({
        pageTitle: optionalPageTitleSchema,
        leftTopText: leftTopTextSchema.optional(),
        leftBottomText: leftBottomTextSchema.optional(),
        rightTopImage: imageMetaSchema.optional(),
        rightBottomImage: imageMetaSchema.optional(),
      })
      .strict(),
  })
  .strict();

export type ProfileCardConfig = z.infer<typeof profileCardConfigSchema>;
