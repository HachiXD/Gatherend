import type { GradientColorStop } from "@/components/ui/gradient-slider";

export type UsernameColor =
  | {
      type: "solid";
      color: string;
    }
  | {
      type: "gradient";
      colors: GradientColorStop[];
      angle: number;
      animated?: boolean;
      animationType?: "shift" | "shimmer" | "pulse";
    }
  | null;

export interface EditableGradientColorStop extends GradientColorStop {
  editorId: string;
}

export interface UsernameColorState {
  mode: "solid" | "gradient";
  solidColor: string;
  gradientColors: EditableGradientColorStop[];
  gradientAngle: number;
  gradientAnimated: boolean;
  animationType: "shift" | "shimmer" | "pulse";
  selectedGradientId: string | null;
}
