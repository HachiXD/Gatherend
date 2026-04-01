import { ChannelType } from "@prisma/client";

type ChannelLike = {
  id: string;
  type: ChannelType;
  position: number;
};

/**
 * Prioridad para navegación normal de miembros:
 * 1. Último canal visitado si sigue existiendo
 * 2. Primer canal TEXT por posición
 * 3. Fallback defensivo: primer canal por posición
 */
export function resolveInitialChannelId(
  channels: ChannelLike[],
  lastChannelId: string | null,
): string | null {
  if (channels.length === 0) return null;

  if (lastChannelId) {
    const existingLastChannel = channels.find(
      (channel) => channel.id === lastChannelId,
    );
    if (existingLastChannel) return existingLastChannel.id;
  }

  const sortedChannels = [...channels].sort((a, b) => a.position - b.position);
  const firstTextChannel = sortedChannels.find(
    (channel) => channel.type === ChannelType.TEXT,
  );

  return firstTextChannel?.id ?? sortedChannels[0]?.id ?? null;
}
