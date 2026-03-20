"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export type { GradientColorStop } from "../../../types";
import type { GradientColorStop } from "../../../types";

interface GradientSliderProps<
  T extends GradientColorStop = GradientColorStop,
> extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  colors: T[];
  onChange: (colors: T[]) => void;
  onColorClick?: (index: number) => void;
  selectedIndex?: number | null;
  onSelectedIndexChange?: (index: number | null) => void;
  selectedColorId?: string | null;
  onSelectedColorIdChange?: (id: string | null) => void;
  getColorId?: (color: T, index: number) => string;
  createColor?: (color: GradientColorStop) => T;
  angle?: number;
  type?: "linear" | "radial";
  className?: string;
  minColors?: number;
  maxColors?: number;
  allowAdd?: boolean;
  showActualGradient?: boolean;
}

export function GradientSlider<
  T extends GradientColorStop = GradientColorStop,
>({
  colors,
  onChange,
  onColorClick,
  selectedIndex: selectedIndexProp,
  onSelectedIndexChange,
  selectedColorId,
  onSelectedColorIdChange,
  getColorId,
  createColor,
  angle = 90,
  type = "linear",
  className,
  minColors: _minColors = 2,
  maxColors = 4,
  allowAdd = true,
  showActualGradient = false,
  ...props
}: GradientSliderProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingColorId, setDraggingColorId] = useState<string | null>(null);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<
    number | null
  >(null);

  const selectedIndex =
    selectedIndexProp === undefined ? internalSelectedIndex : selectedIndexProp;

  const resolveColorId = useCallback(
    (color: T, index: number) => getColorId?.(color, index) ?? `${index}`,
    [getColorId],
  );

  const getIndexByColorId = useCallback(
    (targetId: string) =>
      colors.findIndex(
        (color, index) => resolveColorId(color, index) === targetId,
      ),
    [colors, resolveColorId],
  );

  const setSelectedIndex = useCallback(
    (index: number | null, colorIdOverride?: string | null) => {
      if (selectedIndexProp === undefined) {
        setInternalSelectedIndex(index);
      }
      onSelectedIndexChange?.(index);
      if (colorIdOverride !== undefined) {
        onSelectedColorIdChange?.(colorIdOverride);
        return;
      }

      onSelectedColorIdChange?.(
        index === null || colors[index] === undefined
          ? null
          : resolveColorId(colors[index], index),
      );
    },
    [
      colors,
      onSelectedColorIdChange,
      onSelectedIndexChange,
      resolveColorId,
      selectedIndexProp,
    ],
  );

  const gradientCSS = (() => {
    const sortedColors = [...colors].sort((a, b) => a.position - b.position);
    const stops = sortedColors
      .map((c) => `${c.color} ${c.position}%`)
      .join(", ");

    if (!showActualGradient) {
      return `linear-gradient(90deg, ${stops})`;
    }

    if (type === "radial") {
      return `radial-gradient(circle at center, ${stops})`;
    }

    return `linear-gradient(${angle}deg, ${stops})`;
  })();

  const getPositionFromEvent = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return Math.round(Math.max(0, Math.min(100, percentage)));
  }, []);

  const handleMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingColorId(resolveColorId(colors[index], index));
      setSelectedIndex(index);
    },
    [colors, resolveColorId, setSelectedIndex],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingColorId === null) return;

      const draggingIndex = getIndexByColorId(draggingColorId);
      if (draggingIndex === -1) return;

      const newPosition = getPositionFromEvent(e.clientX);
      const newColors = [...colors];
      newColors[draggingIndex] = {
        ...newColors[draggingIndex],
        position: newPosition,
      };
      onChange(newColors);
    },
    [
      colors,
      draggingColorId,
      getIndexByColorId,
      getPositionFromEvent,
      onChange,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingColorId(null);
  }, []);

  useEffect(() => {
    if (draggingColorId !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingColorId, handleMouseMove, handleMouseUp]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!allowAdd) return;
      if (colors.length >= maxColors) return;
      if (draggingColorId !== null) return;

      const position = getPositionFromEvent(e.clientX);

      const sortedColors = [...colors].sort((a, b) => a.position - b.position);
      let leftColor = sortedColors[0];
      let rightColor = sortedColors[sortedColors.length - 1];

      for (let i = 0; i < sortedColors.length - 1; i++) {
        if (
          sortedColors[i].position <= position &&
          sortedColors[i + 1].position >= position
        ) {
          leftColor = sortedColors[i];
          rightColor = sortedColors[i + 1];
          break;
        }
      }

      const newColor = interpolateColor(
        leftColor.color,
        rightColor.color,
        (position - leftColor.position) /
          (rightColor.position - leftColor.position || 1),
      );

      const newStop = createColor
        ? createColor({ color: newColor, position })
        : ({ color: newColor, position } as T);
      const newColors = [...colors, newStop];
      const newColorId = resolveColorId(newStop, newColors.length - 1);
      onChange(newColors);
      setSelectedIndex(newColors.length - 1, newColorId);
    },
    [
      allowAdd,
      colors,
      createColor,
      draggingColorId,
      getPositionFromEvent,
      maxColors,
      onChange,
      resolveColorId,
      setSelectedIndex,
    ],
  );

  const handleDoubleClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onColorClick?.(index);
    },
    [onColorClick],
  );

  const handleHandleClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndex(index);
      onColorClick?.(index);
    },
    [onColorClick, setSelectedIndex],
  );

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div
        className={cn(
          "relative h-10 border border-theme-border-subtle bg-theme-bg-edit-form/35 select-none",
          allowAdd ? "cursor-crosshair" : "cursor-default",
        )}
      >
        <div
          ref={trackRef}
          className={cn(
            "absolute inset-x-2 mx-3 top-1/2 h-4 -translate-y-1/2",
            allowAdd ? "cursor-crosshair" : "cursor-default",
          )}
          onClick={handleTrackClick}
        >
          <div className="absolute inset-0" style={{ background: gradientCSS }} />

          {colors.map((stop, index) => {
            const colorId = resolveColorId(stop, index);
            const isSelected =
              selectedColorId !== undefined
                ? selectedColorId === colorId
                : selectedIndex === index;

            return (
              <div
                key={colorId}
                className={cn(
                  "absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab border transition-transform",
                  draggingColorId === colorId && "cursor-grabbing scale-105",
                  isSelected
                    ? "z-10 border-theme-channel-type-active-border"
                    : "z-0 border-theme-border-subtle hover:border-theme-channel-type-inactive-hover-border",
                )}
                style={{
                  left: `${clampPercent(stop.position)}%`,
                  top: "50%",
                  backgroundColor: stop.color,
                }}
                onMouseDown={(e) => handleMouseDown(index, e)}
                onClick={(e) => handleHandleClick(index, e)}
                onDoubleClick={(e) => handleDoubleClick(index, e)}
                title={`${stop.color} @ ${stop.position}%`}
              ></div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-theme-text-muted">
        {!allowAdd
          ? "Arrastra los colores para mover"
          : colors.length < maxColors
            ? "Click en la barra para aÃ±adir â€¢ Arrastra para mover"
            : "Arrastra los colores para mover"}
      </p>
    </div>
  );
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  if (!c1 || !c2) return color1;

  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);

  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
