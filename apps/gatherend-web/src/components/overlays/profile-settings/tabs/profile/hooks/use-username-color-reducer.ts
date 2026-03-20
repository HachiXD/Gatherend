"use client";

import { useReducer, useCallback, useMemo } from "react";
import { DEFAULT_USERNAME_COLOR } from "@/lib/theme/presets";
import { normalizeUsernameGradientStops } from "@/lib/username-gradient-stops";
import type { GradientColorStop } from "@/components/ui/gradient-slider";
import type { UsernameColor } from "../types";

let usernameGradientStopCounter = 0;

function createUsernameGradientStopId(): string {
  usernameGradientStopCounter += 1;
  return `username-gradient-stop-${usernameGradientStopCounter}`;
}

export interface EditableGradientColorStop extends GradientColorStop {
  editorId: string;
}

function clampGradientAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 90;
  }

  return Math.max(0, Math.min(180, Math.round(angle)));
}

export function createEditableGradientColorStop(
  stop: GradientColorStop,
): EditableGradientColorStop {
  return {
    color: stop.color,
    position: stop.position,
    editorId: createUsernameGradientStopId(),
  };
}

function toEditableGradientStops(
  colors: readonly GradientColorStop[],
): EditableGradientColorStop[] {
  return normalizeUsernameGradientStops(colors).map(createEditableGradientColorStop);
}

function stripEditableGradientStops(
  colors: readonly EditableGradientColorStop[],
): GradientColorStop[] {
  return normalizeUsernameGradientStops(colors).map(({ color, position }) => ({
    color,
    position,
  }));
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

type UsernameColorAction =
  | { type: "SET_MODE"; payload: "solid" | "gradient" }
  | { type: "SET_SOLID_COLOR"; payload: string }
  | { type: "SET_GRADIENT_COLORS"; payload: EditableGradientColorStop[] }
  | { type: "SET_GRADIENT_ANGLE"; payload: number }
  | { type: "SET_GRADIENT_ANIMATED"; payload: boolean }
  | { type: "SET_ANIMATION_TYPE"; payload: "shift" | "shimmer" | "pulse" }
  | { type: "SET_SELECTED_ID"; payload: string | null }
  | { type: "UPDATE_SELECTED_COLOR"; payload: string }
  | { type: "REMOVE_SELECTED_COLOR" }
  | { type: "RESET"; payload: UsernameColorState };

function usernameColorReducer(
  state: UsernameColorState,
  action: UsernameColorAction,
): UsernameColorState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_SOLID_COLOR":
      return { ...state, solidColor: action.payload };

    case "SET_GRADIENT_COLORS": {
      const gradientColors = normalizeUsernameGradientStops(action.payload);
      return {
        ...state,
        gradientColors,
        selectedGradientId: gradientColors.some(
          (stop) => stop.editorId === state.selectedGradientId,
        )
          ? state.selectedGradientId
          : null,
      };
    }

    case "SET_GRADIENT_ANGLE":
      return { ...state, gradientAngle: clampGradientAngle(action.payload) };

    case "SET_GRADIENT_ANIMATED":
      return { ...state, gradientAnimated: action.payload };

    case "SET_ANIMATION_TYPE":
      return { ...state, animationType: action.payload };

    case "SET_SELECTED_ID":
      return { ...state, selectedGradientId: action.payload };

    case "UPDATE_SELECTED_COLOR":
      if (state.selectedGradientId === null) return state;
      return {
        ...state,
        gradientColors: state.gradientColors.map((stop) =>
          stop.editorId === state.selectedGradientId
            ? { ...stop, color: action.payload }
            : stop,
        ),
      };

    case "REMOVE_SELECTED_COLOR":
      if (
        state.selectedGradientId === null ||
        state.gradientColors.length <= 2
      ) {
        return state;
      }
      return {
        ...state,
        gradientColors: state.gradientColors.filter(
          (stop) => stop.editorId !== state.selectedGradientId,
        ),
        selectedGradientId: null,
      };

    case "RESET":
      return action.payload;

    default:
      return state;
  }
}

function parseInitialColor(color: unknown): UsernameColorState {
  const defaultState: UsernameColorState = {
    mode: "solid",
    solidColor: DEFAULT_USERNAME_COLOR,
    gradientColors: [
      createEditableGradientColorStop({ color: "#FF5733", position: 0 }),
      createEditableGradientColorStop({ color: "#33FF57", position: 100 }),
    ],
    gradientAngle: 90,
    gradientAnimated: false,
    animationType: "shift",
    selectedGradientId: null,
  };

  if (!color) return defaultState;

  if (typeof color === "string") {
    return { ...defaultState, solidColor: color };
  }

  if (typeof color === "object" && color !== null) {
    const c = color as UsernameColor;
    if (c?.type === "solid") {
      return { ...defaultState, solidColor: c.color };
    }
    if (c?.type === "gradient") {
      return {
        ...defaultState,
        mode: "gradient",
        gradientColors: toEditableGradientStops(c.colors),
        gradientAngle: clampGradientAngle(c.angle),
        gradientAnimated: c.animated || false,
        animationType: c.animationType || "shift",
      };
    }
  }

  return defaultState;
}

export function useUsernameColorReducer(initialColor: unknown) {
  const initialState = useMemo(
    () => parseInitialColor(initialColor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [state, dispatch] = useReducer(usernameColorReducer, initialState);

  const actions = useMemo(
    () => ({
      setMode: (mode: "solid" | "gradient") =>
        dispatch({ type: "SET_MODE", payload: mode }),
      setSolidColor: (color: string) =>
        dispatch({ type: "SET_SOLID_COLOR", payload: color }),
      setGradientColors: (colors: EditableGradientColorStop[]) =>
        dispatch({ type: "SET_GRADIENT_COLORS", payload: colors }),
      setGradientAngle: (angle: number) =>
        dispatch({ type: "SET_GRADIENT_ANGLE", payload: angle }),
      setGradientAnimated: (animated: boolean) =>
        dispatch({ type: "SET_GRADIENT_ANIMATED", payload: animated }),
      setAnimationType: (type: "shift" | "shimmer" | "pulse") =>
        dispatch({ type: "SET_ANIMATION_TYPE", payload: type }),
      setSelectedId: (id: string | null) =>
        dispatch({ type: "SET_SELECTED_ID", payload: id }),
      updateSelectedColor: (color: string) =>
        dispatch({ type: "UPDATE_SELECTED_COLOR", payload: color }),
      removeSelectedColor: () => dispatch({ type: "REMOVE_SELECTED_COLOR" }),
      reset: (nextState: UsernameColorState) =>
        dispatch({ type: "RESET", payload: nextState }),
    }),
    [],
  );

  const buildColor = useCallback((): UsernameColor => {
    if (state.mode === "gradient") {
      return {
        type: "gradient",
        colors: stripEditableGradientStops(state.gradientColors),
        angle: clampGradientAngle(state.gradientAngle),
        animated: state.gradientAnimated,
        animationType: state.gradientAnimated ? state.animationType : undefined,
      };
    }
    return { type: "solid", color: state.solidColor };
  }, [state]);

  return { state, actions, buildColor };
}
