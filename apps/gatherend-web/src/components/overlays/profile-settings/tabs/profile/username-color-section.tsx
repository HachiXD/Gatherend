"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_USERNAME_COLOR } from "@/lib/theme/presets";
import { isValidHexColor } from "@/lib/theme/utils";
import { GradientSlider } from "@/components/ui/gradient-slider";
import type { UsernameColorSectionProps } from "./types";

const fieldInputClass =
  "h-8 rounded-none border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle";
const panelToggleButtonClass =
  "h-6.5 cursor-pointer rounded-none border px-3 text-[13px] transition";
const panelToggleActiveClass =
  "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text";
const panelToggleInactiveClass =
  "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border";

function normalizeHexDraft(value: string): string {
  return value.slice(0, 7).toUpperCase();
}

export const UsernameColorSection = memo(function UsernameColorSection({
  colorState,
  colorActions,
  isSaving,
  t,
}: UsernameColorSectionProps) {
  const [selectedColorDraft, setSelectedColorDraft] = useState("");
  const selectedColor =
    colorState.selectedGradientId !== null
      ? (colorState.gradientColors.find(
          (stop) => stop.editorId === colorState.selectedGradientId,
        ) ?? null)
      : null;

  useEffect(() => {
    setSelectedColorDraft(selectedColor?.color ?? "");
  }, [selectedColor?.color, selectedColor?.editorId]);

  const handleSelectedColorDraftChange = useCallback(
    (value: string) => {
      const nextDraft = normalizeHexDraft(value);
      setSelectedColorDraft(nextDraft);
      if (isValidHexColor(nextDraft)) {
        colorActions.updateSelectedColor(nextDraft);
      }
    },
    [colorActions],
  );

  const commitSelectedColorDraft = useCallback(() => {
    if (!selectedColor) return;

    const normalizedDraft = normalizeHexDraft(selectedColorDraft);
    if (isValidHexColor(normalizedDraft)) {
      colorActions.updateSelectedColor(normalizedDraft);
      setSelectedColorDraft(normalizedDraft);
      return;
    }

    setSelectedColorDraft(selectedColor.color);
  }, [colorActions, selectedColor, selectedColorDraft]);

  const isSelectedColorDraftInvalid =
    selectedColor !== null &&
    selectedColorDraft.length > 0 &&
    selectedColorDraft.startsWith("#") &&
    selectedColorDraft !== selectedColor.color &&
    !isValidHexColor(selectedColorDraft);

  return (
    <div className="space-y-2">
      <span
        id="username-color-label"
        className="block uppercase text-xs font-bold text-theme-text-subtle"
      >
        {t.profile.color}
      </span>

      <div
        className="mb-2 -mt-1.5 flex items-center gap-2"
        role="group"
        aria-labelledby="username-color-label"
      >
        <button
          type="button"
          onClick={() => colorActions.setMode("solid")}
          disabled={isSaving}
          className={cn(
            panelToggleButtonClass,
            colorState.mode === "solid"
              ? panelToggleActiveClass
              : panelToggleInactiveClass,
          )}
          aria-pressed={colorState.mode === "solid"}
        >
          Sólido
        </button>
        <button
          type="button"
          onClick={() => colorActions.setMode("gradient")}
          disabled={isSaving}
          className={cn(
            panelToggleButtonClass,
            colorState.mode === "gradient"
              ? panelToggleActiveClass
              : panelToggleInactiveClass,
          )}
          aria-pressed={colorState.mode === "gradient"}
        >
          Gradiente
        </button>
      </div>

      {colorState.mode === "solid" ? (
        <div className="flex items-center gap-2">
          <label htmlFor="username-solid-color" className="sr-only">
            Color sólido
          </label>
          <div
            className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-none border border-theme-border-subtle"
            style={{ backgroundColor: colorState.solidColor }}
          >
            <input
              id="username-solid-color-picker"
              name="username-solid-color-picker"
              type="color"
              value={colorState.solidColor}
              onChange={(e) => colorActions.setSolidColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              disabled={isSaving}
              aria-label="Selector de color"
            />
          </div>
          <Input
            id="username-solid-color"
            name="username-solid-color"
            disabled={isSaving}
            className={cn(fieldInputClass, "font-mono uppercase")}
            placeholder={DEFAULT_USERNAME_COLOR}
            value={colorState.solidColor}
            onChange={(e) => colorActions.setSolidColor(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-2 border border-theme-border-subtle bg-theme-bg-edit-form/30 px-3 py-2">
          <div className="space-y-0 border-b border-theme-border-subtle pb-1">
            <div className="space-y-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-subtle">
                Gradient Editor
              </p>
              <p className="text-[10px] text-theme-text-muted ">
                Click the bar to add colors and drag them to reposition.
              </p>
            </div>
          </div>

          <GradientSlider
            colors={colorState.gradientColors}
            onChange={colorActions.setGradientColors}
            getColorId={(stop) => stop.editorId}
            createColor={(stop) => ({
              ...stop,
              editorId: crypto.randomUUID(),
            })}
            selectedColorId={colorState.selectedGradientId}
            onSelectedColorIdChange={colorActions.setSelectedId}
            angle={colorState.gradientAngle}
            showActualGradient
            minColors={2}
            maxColors={4}
            className="[&_p]:hidden"
          />

          {selectedColor && (
            <div className="space-y-1 border border-theme-border-subtle bg-theme-bg-edit-form/35 p-2">
              <div className="flex items-center justify-between gap-2 -mt-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-theme-text-subtle">
                  Selected Color
                </span>
                <span className="border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2 py-0 text-[11px] text-theme-text-muted">
                  {selectedColor.position}%
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-none border border-theme-border-subtle"
                    style={{ backgroundColor: selectedColor.color }}
                  >
                    <input
                      id="username-gradient-color-picker"
                      name="username-gradient-color-picker"
                      type="color"
                      value={selectedColor.color}
                      onChange={(e) =>
                        colorActions.updateSelectedColor(e.target.value)
                      }
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      disabled={isSaving}
                      aria-label="Selector de color para gradiente"
                    />
                  </div>
                  <Input
                    id="username-gradient-color-hex"
                    name="username-gradient-color-hex"
                    disabled={isSaving}
                    aria-invalid={isSelectedColorDraftInvalid}
                    className={cn(
                      fieldInputClass,
                      "h-8 flex-1 font-mono text-xs uppercase mr-0.5",
                      isSelectedColorDraftInvalid &&
                        "border-red-400 text-red-200 focus-visible:border-red-400",
                    )}
                    value={selectedColorDraft}
                    onChange={(e) =>
                      handleSelectedColorDraftChange(e.target.value)
                    }
                    onBlur={commitSelectedColorDraft}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitSelectedColorDraft();
                      }
                    }}
                  />
                  {colorState.gradientColors.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={colorActions.removeSelectedColor}
                      disabled={isSaving}
                      className="h-8 w-8 mr-1 cursor-pointer rounded-none border border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg hover:bg-theme-channel-type-inactive-bg p-0 text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {isSelectedColorDraftInvalid && (
                  <p className="text-[10px] text-red-400">
                    Enter a valid hex color like #A1B2C3.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-0 border border-theme-border-subtle bg-theme-bg-edit-form/35 p-2">
            <div className="flex items-center justify-between gap-2 -mt-1">
              <label
                htmlFor="username-gradient-angle"
                className="text-[11px] font-semibold uppercase tracking-[0.05em] text-theme-text-subtle"
              >
                Angle
              </label>
              <span className="border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2 py-0.5 text-[11px] text-theme-text-muted">
                {colorState.gradientAngle}°
              </span>
            </div>
            <input
              id="username-gradient-angle"
              name="username-gradient-angle"
              type="range"
              min="0"
              max="180"
              value={colorState.gradientAngle}
              onChange={(e) =>
                colorActions.setGradientAngle(parseInt(e.target.value))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-none bg-theme-bg-edit-form accent-theme-accent-primary"
              disabled={isSaving}
              aria-label="Angulo del gradiente"
            />
          </div>

          <div className="border-t border-theme-border-subtle pt-2">
            <button
              type="button"
              onClick={() => {
                const newValue = !colorState.gradientAnimated;
                colorActions.setGradientAnimated(newValue);
                if (newValue) {
                  colorActions.setAnimationType("shift");
                }
              }}
              disabled={isSaving}
              className={cn(
                panelToggleButtonClass,
                "w-full justify-center",
                colorState.gradientAnimated
                  ? panelToggleActiveClass
                  : panelToggleInactiveClass,
              )}
            >
              Animar gradiente al pasar el mouse
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
