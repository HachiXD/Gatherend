import { useEffect, useRef, useState, useCallback } from "react";
import { isDicebearUrl } from "@/lib/avatar-utils";

interface UseColorExtractionOptions {
  /** URL de la imagen */
  imageUrl: string | null | undefined;
  /** Callback cuando se extrae el color */
  onColorExtracted?: (color: string) => void;
}

interface UseColorExtractionResult {
  /** Color dominante extraído */
  dominantColor: string | null;
  /** Si está procesando */
  isProcessing: boolean;
  /** Handler para pasar al evento onLoad de la imagen */
  handleImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Hook para extraer color dominante de imágenes de forma asíncrona.
 * Usa Web Worker cuando está disponible, fallback a requestIdleCallback/setTimeout.
 *
 * IMPORTANTE: Este hook está diseñado para usarse con el evento onLoad
 * del componente Image de Next.js, eliminando la necesidad de un <img> oculto.
 */
export function useColorExtraction({
  imageUrl,
  onColorExtracted,
}: UseColorExtractionOptions): UseColorExtractionResult {
  // Estado que incluye tanto el color como la URL para la que fue calculado
  const [colorState, setColorState] = useState<{
    color: string | null;
    forUrl: string | null | undefined;
  }>({ color: null, forUrl: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Ref para la URL actual durante el procesamiento (para el worker callback)
  const processingUrlRef = useRef<string | null | undefined>(null);

  // El color efectivo es null si la URL cambió desde que se calculó
  const effectiveColor =
    colorState.forUrl === imageUrl ? colorState.color : null;

  // Función para establecer el color con la URL asociada
  const setColor = useCallback(
    (color: string, forUrl: string | null | undefined) => {
      setColorState({ color, forUrl });
      onColorExtracted?.(color);
    },
    [onColorExtracted]
  );

  // Solo crear Worker si hay URL que procesar
  useEffect(() => {
    if (!imageUrl || typeof Worker === "undefined") return;
    try {
      workerRef.current = new Worker(
          new URL("../workers/color-extraction.worker.ts", import.meta.url)
        );

      workerRef.current.onmessage = (event) => {
          if (event.data.type === "colorResult" && event.data.color) {
            setColor(event.data.color, processingUrlRef.current);
          }
          setIsProcessing(false);
        };
    } catch {
      workerRef.current = null;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [imageUrl, setColor]);

  // Función de extracción de color (fallback sin worker)
  const extractColorFallback = useCallback(
    (
      imageData: ImageData,
      isDicebear: boolean,
      forUrl: string | null | undefined
    ) => {
      const { data, width } = imageData;

      const processColor = () => {
        try {
          if (isDicebear) {
            // Extraer color de esquina
            const index = (5 * width + 5) * 4;
            let r = data[index];
            let g = data[index + 1];
            let b = data[index + 2];

            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = Math.round((r + (gray - r) * 0.4) * 0.35);
            g = Math.round((g + (gray - g) * 0.4) * 0.35);
            b = Math.round((b + (gray - b) * 0.4) * 0.35);

            return `rgb(${r}, ${g}, ${b})`;
          } else {
            // Extraer color dominante (versión simplificada para fallback)
            const colorMap = new Map<
              string,
              { count: number; r: number; g: number; b: number }
            >();
            const quantize = (v: number) => Math.floor(v / 16) * 16; // Más agresivo para fallback

            for (let i = 0; i < data.length; i += 16) {
              // Saltar pixels para velocidad
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              if (a < 128) continue;
              const brightness = (r + g + b) / 3;
              if (brightness < 20 || brightness > 240) continue;

              const key = `${quantize(r)},${quantize(g)},${quantize(b)}`;
              const existing = colorMap.get(key);
              if (existing) {
                existing.count++;
                existing.r += r;
                existing.g += g;
                existing.b += b;
              } else {
                colorMap.set(key, { count: 1, r, g, b });
              }
            }

            let dominant = { count: 0, r: 0, g: 0, b: 0 };
            for (const color of colorMap.values()) {
              if (color.count > dominant.count) dominant = color;
            }

            if (dominant.count === 0) return null;

            let r = Math.round(dominant.r / dominant.count);
            let g = Math.round(dominant.g / dominant.count);
            let b = Math.round(dominant.b / dominant.count);

            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = Math.round((r + (gray - r) * 0.4) * 0.35);
            g = Math.round((g + (gray - g) * 0.4) * 0.35);
            b = Math.round((b + (gray - b) * 0.4) * 0.35);

            return `rgb(${r}, ${g}, ${b})`;
          }
        } catch {
          return null;
        }
      };

      // Usar requestIdleCallback si está disponible
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
          const color = processColor();
          if (color) {
            setColor(color, forUrl);
          }
          setIsProcessing(false);
        });
      } else {
        setTimeout(() => {
          const color = processColor();
          if (color) {
            setColor(color, forUrl);
          }
          setIsProcessing(false);
        }, 0);
      }
    },
    [setColor]
  );

  // Handler para el evento onLoad de la imagen
  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (!imageUrl) return;

      const img = event.currentTarget;
      setIsProcessing(true);

      // Guardar la URL para la que estamos procesando
      processingUrlRef.current = imageUrl;

      // Crear canvas para obtener imageData
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      // Escalar para mejor rendimiento
      const maxSize = 50;
      const scale = Math.min(
        maxSize / img.naturalWidth,
        maxSize / img.naturalHeight,
        1
      );
      canvas.width = Math.floor(img.naturalWidth * scale);
      canvas.height = Math.floor(img.naturalHeight * scale);

      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const isDicebear = isDicebearUrl(imageUrl);

        if (workerRef.current) {
          // Usar worker
          workerRef.current.postMessage({
            type: "extractColor",
            imageData,
            isDicebear,
          });
        } else {
          // Fallback sin worker
          extractColorFallback(imageData, isDicebear, imageUrl);
        }
      } catch {
        // CORS u otro error
        setIsProcessing(false);
      }
    },
    [imageUrl, extractColorFallback]
  );

  return {
    dominantColor: effectiveColor,
    isProcessing,
    handleImageLoad,
  };
}
