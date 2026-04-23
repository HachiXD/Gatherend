"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, RotateCcw, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GradientSlider,
  type GradientColorStop,
} from "@/components/ui/gradient-slider";
import { isValidHexColor, clampGradientColor } from "@/lib/theme/utils";
import { normalizeThemeConfig, parseThemeConfig } from "@/lib/theme/runtime";
import { normalizeThemeGradientColorStops } from "@/lib/theme/gradient-stops";
import { DEFAULT_BASE_COLOR, THEME_PRESETS } from "@/lib/theme/presets";
import type { ThemeConfig, ThemeMode } from "@/lib/theme/types";
import { toast } from "sonner";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { Profile } from "@prisma/client";
import { useTranslation } from "@/i18n";
import { useThemePreviewStore } from "@/stores/theme-preview-store";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeConfig: ThemeConfig | null;
}

interface EditableGradientColorStop extends GradientColorStop {
  editorId: string;
}

const sectionLabelClass =
  "block uppercase text-[14px] font-medium text-theme-text-subtle";
const panelSectionClass =
  "space-y-2 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/30 px-3 py-2";
const fieldInputClass =
  "h-8 rounded-lg text-[15px] border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle";
const panelToggleActiveClass =
  "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text";
const panelSelectTriggerClass =
  "h-8 w-full cursor-pointer rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light hover:bg-theme-bg-edit-form/50 focus:border-theme-border-subtle focus:ring-0";
const panelSelectContentClass =
  "w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-lg border-theme-border bg-theme-bg-modal p-0 text-theme-text-secondary [&>div]:p-0";
const panelSelectItemClass =
  "h-8 w-full cursor-pointer rounded-lg border-x-0 border-t-0 border-b border-theme-border-subtle px-2 hover:border-theme-channel-type-active-border hover:bg-theme-channel-type-active-bg hover:text-theme-channel-type-active-text focus:border-theme-channel-type-active-border focus:bg-theme-channel-type-active-bg focus:text-theme-channel-type-active-text";

function normalizeHexDraft(value: string): string {
  return value.slice(0, 7).toUpperCase();
}

function clampGradientAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 90;
  }

  return Math.max(0, Math.min(180, Math.round(angle)));
}

function createEditableGradientColorStop(
  stop: GradientColorStop,
): EditableGradientColorStop {
  return {
    color: stop.color,
    position: stop.position,
    editorId: crypto.randomUUID(),
  };
}

function normalizeEditableGradientColors<T extends EditableGradientColorStop>(
  colors: readonly T[],
): T[] {
  return normalizeThemeGradientColorStops(colors);
}

function toEditableGradientColors(
  colors: (string | { color: string; position: number })[] | undefined,
  defaultColors: GradientColorStop[],
): EditableGradientColorStop[] {
  return normalizeEditableGradientColors(
    normalizeGradientColors(colors, defaultColors).map(
      createEditableGradientColorStop,
    ),
  );
}

function stripEditableGradientColors(
  colors: readonly EditableGradientColorStop[],
): GradientColorStop[] {
  return normalizeEditableGradientColors(colors).map(({ color, position }) => ({
    color,
    position,
  }));
}

// Helper para normalizar colores de gradiente a GradientColorStop[]
function normalizeGradientColors(
  colors: (string | { color: string; position: number })[] | undefined,
  defaultColors: GradientColorStop[],
): GradientColorStop[] {
  if (!colors || colors.length === 0) return defaultColors;

  return colors.map((item, index, arr) => {
    if (typeof item === "string") {
      // Calcular posición equidistante para strings
      const position = arr.length === 1 ? 50 : (index / (arr.length - 1)) * 100;
      return { color: item, position: Math.round(position) };
    }
    return item;
  });
}

function interpolateHexColor(
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

function getNextGradientStop(colors: GradientColorStop[]): GradientColorStop {
  if (colors.length === 0) return { color: "#000000", position: 50 };
  if (colors.length === 1) return { color: colors[0].color, position: 50 };

  const sorted = [...colors].sort((a, b) => a.position - b.position);

  let bestLeft = sorted[0];
  let bestRight = sorted[sorted.length - 1];
  let bestGap = -1;

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].position - sorted[i].position;
    if (gap > bestGap) {
      bestGap = gap;
      bestLeft = sorted[i];
      bestRight = sorted[i + 1];
    }
  }

  const targetPosition = Math.round(
    (bestLeft.position + bestRight.position) / 2,
  );
  const usedPositions = new Set(colors.map((c) => c.position));

  let position = targetPosition;
  if (usedPositions.has(position)) {
    for (let delta = 1; delta <= 100; delta++) {
      if (position + delta <= 100 && !usedPositions.has(position + delta)) {
        position = position + delta;
        break;
      }
      if (position - delta >= 0 && !usedPositions.has(position - delta)) {
        position = position - delta;
        break;
      }
    }
  }

  const factor =
    (position - bestLeft.position) /
    (bestRight.position - bestLeft.position || 1);
  const clampedFactor = Math.max(0, Math.min(1, factor));
  const color = interpolateHexColor(
    bestLeft.color,
    bestRight.color,
    clampedFactor,
  );

  return { color, position };
}

export function ThemeModal({
  isOpen,
  onClose,
  currentThemeConfig,
}: ThemeModalProps) {
  const queryClient = useQueryClient();
  const setPreviewConfig = useThemePreviewStore(
    (state) => state.setPreviewConfig,
  );
  const clearPreviewConfig = useThemePreviewStore(
    (state) => state.clearPreviewConfig,
  );
  const setPersistedConfig = useThemePreviewStore(
    (state) => state.setPersistedConfig,
  );
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  // Theme state
  const [baseColor, setBaseColor] = useState(
    currentThemeConfig?.baseColor || DEFAULT_BASE_COLOR,
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    currentThemeConfig?.mode || "dark",
  );
  const [useGradient, setUseGradient] = useState(
    !!currentThemeConfig?.gradient,
  );
  const [gradientColors, setGradientColors] = useState<
    EditableGradientColorStop[]
  >(
    toEditableGradientColors(currentThemeConfig?.gradient?.colors, [
      { color: DEFAULT_BASE_COLOR, position: 0 },
      { color: "#1a1a2e", position: 100 },
    ]),
  );
  const [gradientAngle, setGradientAngle] = useState(
    clampGradientAngle(currentThemeConfig?.gradient?.angle || 135),
  );
  const [gradientType, setGradientType] = useState<"linear" | "radial">(
    currentThemeConfig?.gradient?.type || "linear",
  );

  // Sync state when modal opens with new config
  useEffect(() => {
    if (isOpen) {
      setBaseColor(currentThemeConfig?.baseColor || DEFAULT_BASE_COLOR);
      setThemeMode(currentThemeConfig?.mode || "dark");
      setUseGradient(!!currentThemeConfig?.gradient);
      setGradientColors(
        toEditableGradientColors(currentThemeConfig?.gradient?.colors, [
          { color: DEFAULT_BASE_COLOR, position: 0 },
          { color: "#1a1a2e", position: 100 },
        ]),
      );
      setSelectedColorId(null);
      setGradientAngle(
        clampGradientAngle(currentThemeConfig?.gradient?.angle || 135),
      );
      setGradientType(currentThemeConfig?.gradient?.type || "linear");
    }
  }, [isOpen, currentThemeConfig]);

  useEffect(() => {
    if (!isOpen) {
      clearPreviewConfig();
      return;
    }

    const previewConfig: ThemeConfig = {
      baseColor: baseColor !== DEFAULT_BASE_COLOR ? baseColor : undefined,
      mode: themeMode !== "dark" ? themeMode : undefined,
    };

    if (useGradient && gradientColors.length >= 2) {
      previewConfig.gradient = {
        colors: stripEditableGradientColors(gradientColors),
        angle: clampGradientAngle(gradientAngle),
        type: gradientType,
      };
    }

    setPreviewConfig(previewConfig);
  }, [
    baseColor,
    clearPreviewConfig,
    gradientAngle,
    gradientColors,
    gradientType,
    isOpen,
    setPreviewConfig,
    themeMode,
    useGradient,
  ]);

  useEffect(() => {
    return () => {
      clearPreviewConfig();
    };
  }, [clearPreviewConfig]);

  // Re-clamp gradient colors when theme mode changes
  useEffect(() => {
    if (useGradient && gradientColors.length >= 2) {
      const reclampedColors = gradientColors.map((stop) => ({
        ...stop,
        color: clampGradientColor(stop.color, themeMode),
      }));
      // Solo actualizar si hay cambios para evitar loops
      const hasChanges = reclampedColors.some(
        (stop, i) => stop.color !== gradientColors[i].color,
      );
      if (hasChanges) {
        setGradientColors(normalizeEditableGradientColors(reclampedColors));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  const handleCancel = () => {
    clearPreviewConfig();
    onClose();
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);

    try {
      const themeConfig: ThemeConfig = {
        baseColor: baseColor !== DEFAULT_BASE_COLOR ? baseColor : undefined,
        mode: themeMode !== "dark" ? themeMode : undefined,
      };

      if (useGradient && gradientColors.length >= 2) {
        themeConfig.gradient = {
          colors: stripEditableGradientColors(gradientColors),
          angle: clampGradientAngle(gradientAngle),
          type: gradientType,
        };
      }

      const response = await axios.patch("/api/profile/theme", {
        baseColor: themeConfig.baseColor || null,
        mode: themeConfig.mode || null,
        gradient: themeConfig.gradient || null,
      });

      // Actualizar el cache con los datos del servidor (fuente de verdad)
      // Mismo patrón que profile-settings - NO usar refetchQueries porque
      // Prisma Accelerate puede tener datos cacheados viejos
      const serverProfile = response.data;
      const savedThemeConfig =
        normalizeThemeConfig(parseThemeConfig(serverProfile?.themeConfig)) ??
        normalizeThemeConfig(themeConfig);

      setPersistedConfig(savedThemeConfig);
      queryClient.setQueryData(
        ["current-profile"],
        (oldProfile: Profile | undefined) =>
          oldProfile ? { ...oldProfile, ...serverProfile } : serverProfile,
      );

      toast.success(t.modals.theme.saveSuccess);
      clearPreviewConfig();
      onClose();
    } catch (error) {
      console.error("Error saving theme:", error);
      toast.error(t.modals.theme.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset to default
  const handleReset = () => {
    setBaseColor(DEFAULT_BASE_COLOR);
    setThemeMode("dark");
    setUseGradient(false);
    // Colores por defecto ya son oscuros, pero aplicamos clamp por consistencia
    setGradientColors(
      toEditableGradientColors(
        [
          {
            color: clampGradientColor(DEFAULT_BASE_COLOR, "dark"),
            position: 0,
          },
          { color: clampGradientColor("#1a1a2e", "dark"), position: 100 },
        ],
        [],
      ),
    );
    setGradientAngle(135);
    setGradientType("linear");
    setSelectedColorId(null);
  };

  // Estado para el color seleccionado en el gradient slider
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [gradientColorDrafts, setGradientColorDrafts] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setGradientColorDrafts(
      Object.fromEntries(
        gradientColors.map((stop) => [stop.editorId, stop.color]),
      ),
    );
  }, [gradientColors]);

  // Remove gradient color
  const removeGradientColor = (editorId: string) => {
    if (gradientColors.length <= 2) return;

    const nextColors = gradientColors.filter(
      (stop) => stop.editorId !== editorId,
    );
    setGradientColors(nextColors);
    setSelectedColorId((current) =>
      current === editorId ? (nextColors[0]?.editorId ?? null) : current,
    );
  };

  const addGradientColor = () => {
    if (gradientColors.length >= 4) return;

    const nextStop = getNextGradientStop(gradientColors);
    const nextEditableStop = createEditableGradientColorStop({
      ...nextStop,
      color: clampGradientColor(nextStop.color, themeMode),
    });
    const nextColors = normalizeEditableGradientColors([
      ...gradientColors,
      nextEditableStop,
    ]);

    setGradientColors(nextColors);
    setSelectedColorId(nextEditableStop.editorId);
  };

  // Update gradient color (clamped to mode lightness range)
  const updateGradientColor = useCallback(
    (editorId: string, color: string) => {
      const newColors = normalizeEditableGradientColors(
        gradientColors.map((stop) =>
          stop.editorId === editorId
            ? {
                ...stop,
                color: clampGradientColor(color, themeMode),
              }
            : stop,
        ),
      );
      // Aplicar clamp según el modo del tema
      setGradientColors(newColors);
    },
    [gradientColors, themeMode],
  );

  // Handle gradient colors change from slider (with clamping)
  const handleGradientColorsChange = (
    newColors: EditableGradientColorStop[],
  ) => {
    const clampedColors = normalizeEditableGradientColors(
      newColors.map((stop) => ({
        ...stop,
        color: clampGradientColor(stop.color, themeMode),
      })),
    );
    setGradientColors(clampedColors);
  };

  const handleGradientColorDraftChange = useCallback(
    (editorId: string, value: string) => {
      const nextDraft = normalizeHexDraft(value);
      setGradientColorDrafts((current) => ({
        ...current,
        [editorId]: nextDraft,
      }));
      if (isValidHexColor(nextDraft)) {
        updateGradientColor(editorId, nextDraft);
      }
    },
    [updateGradientColor],
  );

  const commitGradientColorDraft = useCallback(
    (editorId: string, fallbackColor: string) => {
      const draft = normalizeHexDraft(
        gradientColorDrafts[editorId] ?? fallbackColor,
      );
      if (isValidHexColor(draft)) {
        updateGradientColor(editorId, draft);
        setGradientColorDrafts((current) => ({
          ...current,
          [editorId]: draft,
        }));
        return;
      }

      setGradientColorDrafts((current) => ({
        ...current,
        [editorId]: fallbackColor,
      }));
    },
    [gradientColorDrafts, updateGradientColor],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-12.5 right-4 z-50 w-[356px] overflow-hidden rounded-lg border border-theme-border bg-theme-bg-dropdown-menu-primary text-theme-text-subtle shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b py-5 border-theme-border bg-theme-bg-secondary/40 px-4 h-8">
        <h3 className="text-[18px] font-bold leading-none tracking-[0.04em] text-theme-text-light">
          {t.modals.theme.title}
        </h3>
        <button
          onClick={handleCancel}
          className="cursor-pointer rounded-lg p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="scrollbar-ultra-thin max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
        {/* Base Color */}
        <div className={panelSectionClass}>
          <Label htmlFor="theme-base-color" className={sectionLabelClass}>
            {t.modals.theme.baseColor}
          </Label>
          <div className="flex items-center -mt-1 gap-2">
            <div
              className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-theme-border-subtle"
              style={{ backgroundColor: baseColor }}
            >
              <input
                id="theme-base-color-picker"
                name="theme-base-color-picker"
                type="color"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                className="absolute  inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Selector de color base"
              />
            </div>
            <Input
              id="theme-base-color"
              name="theme-base-color"
              type="text"
              value={baseColor}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith("#") && val.length <= 7) {
                  setBaseColor(val);
                }
              }}
              onBlur={(e) => {
                if (!isValidHexColor(e.target.value)) {
                  setBaseColor(DEFAULT_BASE_COLOR);
                }
              }}
              className={cn(fieldInputClass, "flex-1 font-mono uppercase")}
              placeholder="#2E8376"
            />
          </div>

          {/* Preset Colors */}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {THEME_PRESETS.slice(0, 12).map((preset) => (
              <button
                key={preset.name}
                onClick={() => setBaseColor(preset.baseColor)}
                className={cn(
                  "h-6 w-6 cursor-pointer rounded-lg border transition",
                  baseColor === preset.baseColor
                    ? "border-theme-channel-type-active-border"
                    : "border-theme-border-subtle hover:border-theme-channel-type-inactive-hover-border",
                )}
                style={{ backgroundColor: preset.baseColor }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        {/* Theme Mode Toggle */}
        <div className={panelSectionClass}>
          <span id="theme-mode-label" className={sectionLabelClass}>
            {t.modals.theme.mode}
          </span>
          <div
            className="-mt-1 flex overflow-hidden rounded-lg border border-theme-border"
            role="group"
            aria-labelledby="theme-mode-label"
          >
            <button
              onClick={() => setThemeMode("dark")}
              className={cn(
                "flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 text-[12px] transition",
                themeMode === "dark"
                  ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                  : "bg-transparent text-theme-text-subtle hover:text-theme-text-primary",
              )}
            >
              <Moon className="h-4 w-4" />
              <span className="text-xs font-medium">{t.modals.theme.dark}</span>
            </button>
            <button
              onClick={() => setThemeMode("light")}
              className={cn(
                "flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 border-l border-theme-border text-[12px] transition",
                themeMode === "light"
                  ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                  : "bg-transparent text-theme-text-subtle hover:text-theme-text-primary",
              )}
            >
              <Sun className="h-4 w-4" />
              <span className="text-xs font-medium">
                {t.modals.theme.light}
              </span>
            </button>
          </div>
        </div>

        {/* Gradient Toggle */}
        <div className={panelSectionClass}>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="theme-use-gradient" className={sectionLabelClass}>
              {t.modals.theme.useGradient}
            </Label>
            <div
              className="flex overflow-hidden rounded-lg border border-theme-border"
              role="group"
              aria-label={t.modals.theme.useGradient}
            >
              <button
                type="button"
                onClick={() => {
                  setUseGradient(true);
                  setGradientColors((prev) =>
                    normalizeEditableGradientColors(
                      prev.map((stop) => ({
                        ...stop,
                        color: clampGradientColor(stop.color, themeMode),
                      })),
                    ),
                  );
                }}
                className={cn(
                  "flex h-6 w-12 cursor-pointer items-center justify-center px-3 text-[12px] transition",
                  useGradient
                    ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                    : "bg-transparent text-theme-text-subtle hover:text-theme-text-primary",
                )}
                aria-pressed={useGradient === true}
              >
                {t.common.yes}
              </button>
              <button
                type="button"
                onClick={() => setUseGradient(false)}
                className={cn(
                  "flex h-6 w-12 cursor-pointer items-center justify-center border-l border-theme-border px-3 text-[12px] transition",
                  useGradient === false
                    ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                    : "bg-transparent text-theme-text-subtle hover:text-theme-text-primary",
                )}
                aria-pressed={useGradient === false}
              >
                {t.common.no}
              </button>
            </div>
          </div>
        </div>

        {/* Gradient Settings */}
        {useGradient && (
          <div className={panelSectionClass}>
            {/* Gradient Slider - positions only */}
            <div className="space-y-2">
              <div className="space-y-0 border-b border-theme-border-subtle pb-1 -mt-1.5">
                <span
                  id="theme-gradient-colors-label"
                  className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-subtle"
                >
                  {t.modals.theme.colors}
                </span>
                <p className="text-[10px] text-theme-text-muted -mt-0.5">
                  Clickea en el botón + para añadir colores y arrástralos en la
                  barra para moverlos.
                </p>
              </div>
              <GradientSlider
                colors={gradientColors}
                onChange={handleGradientColorsChange}
                selectedColorId={selectedColorId}
                onSelectedColorIdChange={setSelectedColorId}
                getColorId={(stop) => stop.editorId}
                angle={gradientAngle}
                type={gradientType}
                minColors={2}
                maxColors={4}
                allowAdd={false}
                className="[&_p]:hidden [&>div:first-child]:rounded-lg [&>div:first-child]:overflow-hidden [&>div:first-child>div]:rounded-lg [&>div:first-child>div>div:first-child]:rounded-lg [&>div:first-child>div>div.absolute]:rounded-md"
                aria-labelledby="theme-gradient-colors-label"
              />
            </div>

            {/* Permanent color editors (Color 1..4) */}
            <div className="space-y-2">
              {gradientColors.map((stop, index) => {
                const colorDraft =
                  gradientColorDrafts[stop.editorId] ?? stop.color;
                const isGradientColorDraftInvalid =
                  colorDraft !== stop.color && !isValidHexColor(colorDraft);

                return (
                  <div
                    key={stop.editorId}
                    className={cn(
                      "rounded-lg border p-2 transition-colors",
                      selectedColorId === stop.editorId
                        ? panelToggleActiveClass
                        : "border-theme-border-subtle bg-theme-bg-edit-form/35 text-theme-text-light",
                    )}
                    onMouseDown={() => setSelectedColorId(stop.editorId)}
                  >
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`theme-gradient-color-${index}`}
                        className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-[0.05em] text-theme-text-subtle"
                      >
                        Color {index + 1}
                      </Label>

                      <div
                        className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-theme-border-subtle"
                        style={{ backgroundColor: stop.color }}
                      >
                        <input
                          id={`theme-gradient-color-picker-${index}`}
                          name={`theme-gradient-color-picker-${index}`}
                          type="color"
                          value={stop.color}
                          onChange={(e) =>
                            updateGradientColor(stop.editorId, e.target.value)
                          }
                          onFocus={() => setSelectedColorId(stop.editorId)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          aria-label={`Selector de color ${index + 1}`}
                        />
                      </div>

                      <Input
                        id={`theme-gradient-color-${index}`}
                        name={`theme-gradient-color-${index}`}
                        type="text"
                        value={colorDraft}
                        onChange={(e) =>
                          handleGradientColorDraftChange(
                            stop.editorId,
                            e.target.value,
                          )
                        }
                        onBlur={() =>
                          commitGradientColorDraft(stop.editorId, stop.color)
                        }
                        onFocus={() => setSelectedColorId(stop.editorId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitGradientColorDraft(stop.editorId, stop.color);
                          }
                        }}
                        aria-invalid={isGradientColorDraftInvalid}
                        className={cn(
                          fieldInputClass,
                          "h-8 w-20 min-w-0 font-mono text-xs uppercase",
                          isGradientColorDraftInvalid &&
                            "border-red-400 text-red-200 focus-visible:border-red-400",
                        )}
                      />

                      <span className="w-9 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 px-1 py-1 text-right text-[11px] font-mono text-theme-text-muted">
                        {stop.position}%
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGradientColor(stop.editorId);
                        }}
                        disabled={gradientColors.length <= 2}
                        className={cn(
                          "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition",
                          gradientColors.length <= 2
                            ? "cursor-not-allowed border-theme-border-subtle bg-theme-bg-edit-form/20 text-theme-text-muted opacity-40"
                            : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border hover:text-red-400",
                        )}
                        title="Quitar color"
                        aria-label="Quitar color"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {isGradientColorDraftInvalid && (
                      <p className="mt-1 text-[10px] text-red-400">
                        Enter a valid hex color like #A1B2C3.
                      </p>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addGradientColor}
                disabled={gradientColors.length >= 4}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed text-[13px] transition",
                  gradientColors.length >= 4
                    ? "cursor-not-allowed border-theme-border-subtle bg-theme-bg-edit-form/20 text-theme-text-muted opacity-40"
                    : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                )}
                title="Agregar color"
                aria-label="Agregar color"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Gradient Type */}
            <div className="space-y-1 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/35 p-2">
              <Label
                htmlFor="theme-gradient-type"
                className="text-[11px] font-semibold uppercase tracking-[0.05em] text-theme-text-subtle"
              >
                {t.modals.theme.type}
              </Label>
              <Select
                name="theme-gradient-type"
                value={gradientType}
                onValueChange={(v) => setGradientType(v as "linear" | "radial")}
              >
                <SelectTrigger
                  id="theme-gradient-type"
                  size="sm"
                  className={cn(panelSelectTriggerClass, "text-xs")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={panelSelectContentClass}>
                  <SelectItem value="linear" className={panelSelectItemClass}>
                    {t.modals.theme.linear}
                  </SelectItem>
                  <SelectItem value="radial" className={panelSelectItemClass}>
                    {t.modals.theme.radial}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gradient Angle (only for linear) */}
            {gradientType === "linear" && (
              <div className="space-y-1 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/35 p-2">
                <div className="flex items-center justify-between -mt-1 gap-2">
                  <span
                    id="theme-gradient-angle-label"
                    className="text-[11px] font-semibold uppercase tracking-[0.05em] text-theme-text-subtle"
                  >
                    {t.modals.theme.angle}
                  </span>
                  <span className="rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2 py-0.5 text-[11px] font-mono text-theme-text-muted">
                    {gradientAngle}°
                  </span>
                </div>
                <input
                  id="theme-gradient-angle"
                  name="theme-gradient-angle"
                  type="range"
                  min="0"
                  max="180"
                  step="5"
                  value={gradientAngle}
                  onChange={(e) =>
                    setGradientAngle(
                      clampGradientAngle(parseInt(e.target.value)),
                    )
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-theme-bg-edit-form accent-theme-accent-primary"
                  aria-labelledby="theme-gradient-angle-label"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-theme-border bg-theme-bg-secondary/40 px-4 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-6.5 cursor-pointer rounded-lg border border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg px-3 text-[13px] text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border hover:bg-theme-channel-type-inactive-bg hover:text-theme-text-light"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {t.modals.theme.reset}
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-6.5 cursor-pointer rounded-lg bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
          >
            {t.modals.theme.cancel}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-6.5 cursor-pointer rounded-lg bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover"
          >
            {isSaving ? t.modals.theme.saving : t.modals.theme.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
