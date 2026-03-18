"use client";

import { useChannelRedirection } from "@/hooks/use-channel-redirection";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";

/**
 * BoardView - Vista del board (página principal)
 *
 * Esta vista actúa como redirect inteligente usando navegación SPA.
 * La lógica de redirección está encapsulada en useChannelRedirection().
 *
 * Prioridad de redirección (manejada por el hook):
 * 1. Último channel visitado (desde localStorage) si aún existe
 * 2. Canal MAIN si existe
 * 3. Primer canal por posición
 */
export function BoardView() {
  useChannelRedirection();

  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-theme-border-primary" />
        <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-2 text-theme-accent-light animate-pulse" />
      </div>
      <p className="text-[18px] text-theme-text-accent">Loading! ᕙ(`▿´)ᕗ</p>
    </div>
  );
}
