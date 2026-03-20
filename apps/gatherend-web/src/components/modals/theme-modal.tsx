"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, RotateCcw, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import {
  generatePaletteFromBase,
  generateLightPaletteFromBase,
  applyThemeToDOM,
  applyGradientToDOM,
  applyTransparencyToBackgrounds,
  isValidHexColor,
  clampGradientColor,
} from "@/lib/theme/utils";
import {
  buildThemeGradientStopsCss,
  normalizeThemeGradientColorStops,
} from "@/lib/theme/gradient-stops";
import { DEFAULT_BASE_COLOR, THEME_PRESETS } from "@/lib/theme/presets";
import type { GradientConfig, ThemeConfig, ThemeMode } from "@/lib/theme/types";
import { toast } from "sonner";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { Profile } from "@prisma/client";
import { useTranslation } from "@/i18n";

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeConfig: ThemeConfig | null;
}

interface EditableGradientColorStop extends GradientColorStop {
  editorId: string;
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
    normalizeGradientColors(colors, defaultColors).map(createEditableGradientColorStop),
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

// Helper para generar CSS del gradiente con posiciones
function generateGradientPreviewCSS(
  colors: GradientColorStop[],
  angle: number,
  type: "linear" | "radial",
): string {
  const stops = buildThemeGradientStopsCss(colors);
  if (!stops) return "transparent";

  if (type === "radial") {
    return `radial-gradient(circle at center, ${stops})`;
  }
  return `linear-gradient(${angle}deg, ${stops})`;
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
  const [gradientColors, setGradientColors] = useState<EditableGradientColorStop[]>(
    toEditableGradientColors(currentThemeConfig?.gradient?.colors, [
      { color: DEFAULT_BASE_COLOR, position: 0 },
      { color: "#1a1a2e", position: 100 },
    ]),
  );
  const [gradientAngle, setGradientAngle] = useState(
    currentThemeConfig?.gradient?.angle || 135,
  );
  const [gradientType, setGradientType] = useState<"linear" | "radial">(
    currentThemeConfig?.gradient?.type || "linear",
  );

  // Store original config to revert on cancel
  const originalConfigRef = useRef<ThemeConfig | null>(currentThemeConfig);

  // Sync state when modal opens with new config
  useEffect(() => {
    if (isOpen) {
      originalConfigRef.current = currentThemeConfig;
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
      setGradientAngle(currentThemeConfig?.gradient?.angle || 135);
      setGradientType(currentThemeConfig?.gradient?.type || "linear");
    }
  }, [isOpen, currentThemeConfig]);

  // Apply theme preview in real-time
  const applyPreview = useCallback(() => {
    let colors =
      themeMode === "light"
        ? generateLightPaletteFromBase(baseColor)
        : generatePaletteFromBase(baseColor);

    // Si hay degradado activo, aplicar transparencia a los fondos
    if (useGradient && gradientColors.length >= 2) {
      colors = applyTransparencyToBackgrounds(colors);
      const gradient: GradientConfig = {
        colors: stripEditableGradientColors(gradientColors),
        angle: gradientAngle,
        type: gradientType,
      };
      applyGradientToDOM(gradient);
    } else {
      applyGradientToDOM(null);
    }

    applyThemeToDOM(colors);
  }, [
    baseColor,
    themeMode,
    useGradient,
    gradientColors,
    gradientAngle,
    gradientType,
  ]);

  // Apply preview whenever settings change
  useEffect(() => {
    if (isOpen) {
      applyPreview();
    }
  }, [isOpen, applyPreview]);

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

  // Revert to original theme
  const revertToOriginal = useCallback(() => {
    const originalBase =
      originalConfigRef.current?.baseColor || DEFAULT_BASE_COLOR;
    const originalMode = originalConfigRef.current?.mode || "dark";
    const originalGradient = originalConfigRef.current?.gradient;

    let colors =
      originalMode === "light"
        ? generateLightPaletteFromBase(originalBase)
        : generatePaletteFromBase(originalBase);

    // Si había degradado, aplicar transparencia
    if (originalGradient) {
      colors = applyTransparencyToBackgrounds(colors);
    }

    applyThemeToDOM(colors);
    applyGradientToDOM(originalGradient || null);
  }, []);

  // Handle cancel - revert changes
  const handleCancel = () => {
    revertToOriginal();
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
          angle: gradientAngle,
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
      queryClient.setQueryData(
        ["current-profile"],
        (oldProfile: Profile | undefined) =>
          oldProfile ? { ...oldProfile, ...serverProfile } : serverProfile,
      );

      // Re-apply theme to DOM to ensure it persists after modal closes
      let colors =
        themeMode === "light"
          ? generateLightPaletteFromBase(baseColor)
          : generatePaletteFromBase(baseColor);

      if (useGradient && gradientColors.length >= 2) {
        colors = applyTransparencyToBackgrounds(colors);
        applyGradientToDOM({
          colors: stripEditableGradientColors(gradientColors),
          angle: gradientAngle,
          type: gradientType,
        });
      } else {
        applyGradientToDOM(null);
      }

      applyThemeToDOM(colors);

      toast.success(t.modals.theme.saveSuccess);
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
          { color: clampGradientColor(DEFAULT_BASE_COLOR, "dark"), position: 0 },
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

  // Remove gradient color
  const removeGradientColor = (editorId: string) => {
    if (gradientColors.length <= 2) return;

    const nextColors = gradientColors.filter((stop) => stop.editorId !== editorId);
    setGradientColors(nextColors);
    setSelectedColorId((current) =>
      current === editorId ? nextColors[0]?.editorId ?? null : current,
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
  const updateGradientColor = (editorId: string, color: string) => {
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
  };

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-16 right-4 z-50 w-80 bg-theme-bg-dropdown-menu-primary border border-theme-border-secondary rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border-secondary">
        <h3 className="text-sm font-semibold text-theme-text-light">
          {t.modals.theme.title}
        </h3>
        <button
          onClick={handleCancel}
          className="p-1 rounded hover:bg-theme-bg-tertiary transition-colors"
        >
          <X className="w-4 h-4 text-theme-text-muted" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Base Color */}
        <div className="space-y-2">
          <Label
            htmlFor="theme-base-color"
            className="text-xs font-medium text-theme-text-subtle uppercase"
          >
            {t.modals.theme.baseColor}
          </Label>
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-md border border-theme-border-secondary overflow-hidden cursor-pointer relative"
              style={{ backgroundColor: baseColor }}
            >
              <input
                id="theme-base-color-picker"
                name="theme-base-color-picker"
                type="color"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Selector de color base"
              />
            </div>
            <input
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
              className="flex-1 px-2 py-1.5 text-sm bg-theme-bg-input border border-theme-border-secondary rounded text-theme-text-light font-mono uppercase"
              placeholder="#2E8376"
            />
          </div>

          {/* Preset Colors */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {THEME_PRESETS.slice(0, 12).map((preset) => (
              <button
                key={preset.name}
                onClick={() => setBaseColor(preset.baseColor)}
                className={cn(
                  "w-6 h-6 rounded-md border-2 transition-all",
                  baseColor === preset.baseColor
                    ? "border-white scale-110"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: preset.baseColor }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        {/* Theme Mode Toggle */}
        <div className="space-y-2">
          <span
            id="theme-mode-label"
            className="text-xs font-medium text-theme-text-subtle uppercase"
          >
            {t.modals.theme.mode}
          </span>
          <div
            className="flex gap-2"
            role="group"
            aria-labelledby="theme-mode-label"
          >
            <button
              onClick={() => setThemeMode("dark")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border transition-all",
                themeMode === "dark"
                  ? "bg-theme-accent-primary/20 border-theme-accent-primary text-theme-text-light"
                  : "bg-theme-bg-modal border-theme-border-secondary text-theme-text-muted hover:border-theme-border-primary",
              )}
            >
              <Moon className="w-4 h-4" />
              <span className="text-xs font-medium">{t.modals.theme.dark}</span>
            </button>
            <button
              onClick={() => setThemeMode("light")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border transition-all",
                themeMode === "light"
                  ? "bg-theme-accent-primary/20 border-theme-accent-primary text-theme-text-light"
                  : "bg-theme-bg-modal border-theme-border-secondary text-theme-text-muted hover:border-theme-border-primary",
              )}
            >
              <Sun className="w-4 h-4" />
              <span className="text-xs font-medium">
                {t.modals.theme.light}
              </span>
            </button>
          </div>
        </div>

        {/* Gradient Toggle */}
        <div className="flex items-center justify-between py-2">
          <Label
            htmlFor="theme-use-gradient"
            className="text-xs font-medium text-theme-text-subtle uppercase"
          >
            {t.modals.theme.useGradient}
          </Label>
          <Switch
            id="theme-use-gradient"
            checked={useGradient}
            onCheckedChange={(checked) => {
              setUseGradient(checked);
              // Cuando se activa el degradado, clampear los colores al modo actual
              if (checked) {
                setGradientColors((prev) =>
                  normalizeEditableGradientColors(
                    prev.map((stop) => ({
                      ...stop,
                      color: clampGradientColor(stop.color, themeMode),
                    })),
                  ),
                );
              }
            }}
          />
        </div>

        {/* Gradient Settings */}
        {useGradient && (
          <div className="space-y-3 p-3 bg-theme-bg-modal rounded-md">
            {/* Gradient Slider - positions only */}
            <div className="space-y-2">
              <span
                id="theme-gradient-colors-label"
                className="text-xs text-theme-text-muted"
              >
                {t.modals.theme.colors}
              </span>
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
                aria-labelledby="theme-gradient-colors-label"
              />
            </div>

            {/* Permanent color editors (Color 1..4) */}
            <div className="space-y-2">
              {gradientColors.map((stop, index) => (
                <div
                  key={stop.editorId}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border transition-colors",
                    selectedColorId === stop.editorId
                      ? "border-theme-accent-primary bg-theme-accent-primary/10"
                      : "border-theme-border-secondary bg-theme-bg-tertiary",
                  )}
                  onMouseDown={() => setSelectedColorId(stop.editorId)}
                >
                  <Label
                    htmlFor={`theme-gradient-color-${index}`}
                    className="w-14 text-xs text-theme-text-muted shrink-0"
                  >
                    Color {index + 1}
                  </Label>

                  <div
                    className="w-8 h-8 rounded border border-theme-border-secondary overflow-hidden cursor-pointer relative shrink-0"
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

                  <input
                    id={`theme-gradient-color-${index}`}
                    name={`theme-gradient-color-${index}`}
                    type="text"
                    value={stop.color}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("#") && val.length <= 7) {
                        updateGradientColor(stop.editorId, val);
                      }
                    }}
                    onFocus={() => setSelectedColorId(stop.editorId)}
                    className="w-24 min-w-0 px-2 py-1 text-xs bg-theme-bg-input border border-theme-border-secondary rounded text-theme-text-light font-mono uppercase"
                  />

                  <span className="w-10 text-right text-xs text-theme-text-muted font-mono">
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
                      "p-1 rounded transition-colors",
                      gradientColors.length <= 2
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-red-500/20",
                    )}
                    title="Quitar color"
                    aria-label="Quitar color"
                  >
                    <X
                      className="w-3.5 h-3.5 text-red-400"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addGradientColor}
                disabled={gradientColors.length >= 4}
                className={cn(
                  "w-full h-8 rounded border border-dashed border-theme-border-secondary flex items-center justify-center transition-colors",
                  gradientColors.length >= 4
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-theme-bg-tertiary",
                )}
                title="Agregar color"
                aria-label="Agregar color"
              >
                <Plus
                  className="w-4 h-4 text-theme-text-muted"
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Gradient Type */}
            <div className="space-y-2">
              <Label
                htmlFor="theme-gradient-type"
                className="text-xs text-theme-text-muted"
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
                  className="h-8 text-xs bg-theme-bg-input border-theme-border-secondary"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">
                    {t.modals.theme.linear}
                  </SelectItem>
                  <SelectItem value="radial">
                    {t.modals.theme.radial}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gradient Angle (only for linear) */}
            {gradientType === "linear" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    id="theme-gradient-angle-label"
                    className="text-xs text-theme-text-muted"
                  >
                    {t.modals.theme.angle}
                  </span>
                  <span className="text-xs text-theme-text-muted font-mono">
                    {gradientAngle}°
                  </span>
                </div>
                <Slider
                  value={[gradientAngle]}
                  onValueChange={([v]) => setGradientAngle(v)}
                  min={0}
                  max={360}
                  step={5}
                  className="w-full"
                  aria-labelledby="theme-gradient-angle-label"
                />
              </div>
            )}

            {/* Gradient Preview */}
            <div className="space-y-1">
              <span className="text-xs text-theme-text-muted block">
                {t.modals.theme.preview}
              </span>
              <div
                className="h-12 rounded-md border border-theme-border-secondary"
                style={{
                  background: generateGradientPreviewCSS(
                    gradientColors,
                    gradientAngle,
                    gradientType,
                  ),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border-secondary">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-theme-text-muted hover:text-theme-text-light"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          {t.modals.theme.reset}
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer"
          >
            {t.modals.theme.cancel}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover cursor-pointer"
          >
            {isSaving ? t.modals.theme.saving : t.modals.theme.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
