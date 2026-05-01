import { Text } from "@/src/components/app-typography";

import { parsePostContent } from "@/src/lib/parse-post-formatting";
import { useTheme } from "@/src/theme/theme-provider";

type PostContentProps = {
  content: string;
  fontSize?: number;
  color?: string;
};

export function PostContent({ content, fontSize = 15, color }: PostContentProps) {
  const { colors } = useTheme();
  const textColor = color ?? colors.textSecondary;

  return (
    <Text
      style={{
        color: textColor,
        fontSize,
        lineHeight: fontSize * 1.4,
      }}
    >
      {parsePostContent(content, colors.textAccent)}
    </Text>
  );
}
