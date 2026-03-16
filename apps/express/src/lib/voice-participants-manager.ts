import { logger } from "./logger.js";
import {
  getRedisClient,
  isRedisConfigured,
  isRedisConnected,
} from "./redis.js";
import type { RedisClientType } from "redis";

/**
 * Interface para un participante de voice channel
 */
export interface VoiceParticipant {
  profileId: string;
  username: string;
  avatarUrl: string | null;
  usernameColor: string | null;
  joinedAt: string;
  serverId: string;
}

// Fix #7: Reduced TTL to 5 minutes (was 1 hour) - prevents ghost participants
// If a server crashes, participants will be cleaned up after 5 minutes max
const VOICE_TTL = 300; // 5 minutes in seconds
// Prefijo para las keys de voice participants
const VOICE_PREFIX = "voice:";
// Fix #7: More frequent heartbeat (1 minute instead of 2) to keep TTL fresh
const HEARTBEAT_INTERVAL = 60000; // 1 minute in ms

// Maximum participants per voice channel
export const MAX_CHANNEL_PARTICIPANTS = 49;

// Generar un ID único para esta instancia del servidor
const SERVER_ID = `server:${process.pid}:${Date.now()}`;

/**
 * Maneja los participantes de voice channels usando Redis
 * Soporta escalado horizontal con múltiples instancias del servidor
 *
 * Estructura de datos en Redis:
 * - Hash: voice:{channelId} -> { profileId: JSON(VoiceParticipant) }
 * - TTL automático de 5 minutos (renovado con heartbeat)
 *
 * NOTA: Usa los clientes Redis compartidos de redis.ts para evitar
 * conexiones duplicadas.
 */
export class VoiceParticipantsManager {
  private fallbackParticipants: Map<string, Map<string, VoiceParticipant>> =
    new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  // Track de participantes locales para heartbeat
  private localParticipants: Map<string, Set<string>> = new Map(); // channelId -> Set<profileId>

  /**
   * Helper para obtener el cliente Redis de forma segura
   */
  private getRedis(): RedisClientType | null {
    if (!isRedisConfigured() || !isRedisConnected()) {
      return null;
    }
    try {
      return getRedisClient();
    } catch {
      return null;
    }
  }

  /**
   * Inicializa el VoiceParticipantsManager después de que Redis esté listo
   * Debe llamarse después de initializeRedis() en server.ts
   */
  async initialize(): Promise<void> {
    if (!isRedisConfigured()) {
      logger.warn(
        "REDIS_URL not configured, using in-memory voice participants (not suitable for production)",
      );
      return;
    }

    // Iniciar heartbeat para mantener TTL actualizado
    this.startHeartbeat();

    logger.info(
      "VoiceParticipantsManager initialized with shared Redis clients",
    );
  }

  /**
   * Heartbeat para renovar TTL de canales con participantes de esta instancia
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      const redis = this.getRedis();
      if (!redis) return;

      try {
        // Renovar TTL de todos los canales con participantes locales
        for (const [
          channelId,
          profileIds,
        ] of this.localParticipants.entries()) {
          if (profileIds.size > 0) {
            const key = `${VOICE_PREFIX}${channelId}`;
            await redis.expire(key, VOICE_TTL);
          }
        }
      } catch (error) {
        logger.error("Voice heartbeat error:", error);
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Result type for addParticipant operation
   */

  /**
   * Agrega un participante a un voice channel
   * Returns: { success: true } or { success: false, reason: string }
   */
  async addParticipant(
    channelId: string,
    participant: Omit<VoiceParticipant, "joinedAt" | "serverId">,
  ): Promise<{ success: boolean; reason?: string }> {
    // Fix #8: Check participant limit before adding
    const currentCount = await this.getParticipantCount(channelId);
    if (currentCount >= MAX_CHANNEL_PARTICIPANTS) {
      logger.warn(
        `Channel ${channelId} is full (${currentCount}/${MAX_CHANNEL_PARTICIPANTS})`,
      );
      return { success: false, reason: "CHANNEL_FULL" };
    }

    const fullParticipant: VoiceParticipant = {
      ...participant,
      joinedAt: new Date().toISOString(),
      serverId: SERVER_ID,
    };

    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${VOICE_PREFIX}${channelId}`;

        // Usar multi para operaciones atómicas
        await redis
          .multi()
          .hSet(key, participant.profileId, JSON.stringify(fullParticipant))
          .expire(key, VOICE_TTL)
          .exec();

        // Track local para heartbeat
        if (!this.localParticipants.has(channelId)) {
          this.localParticipants.set(channelId, new Set());
        }
        this.localParticipants.get(channelId)!.add(participant.profileId);

        return { success: true };
      } catch (error) {
        logger.error("Redis addParticipant error:", error);
        // Fallback a memoria
        this.addParticipantToMemory(channelId, fullParticipant);
        return { success: true };
      }
    } else {
      this.addParticipantToMemory(channelId, fullParticipant);
      return { success: true };
    }
  }

  /**
   * Fallback: Agrega participante a memoria
   */
  private addParticipantToMemory(
    channelId: string,
    participant: VoiceParticipant,
  ): void {
    if (!this.fallbackParticipants.has(channelId)) {
      this.fallbackParticipants.set(channelId, new Map());
    }
    this.fallbackParticipants
      .get(channelId)!
      .set(participant.profileId, participant);
  }

  /**
   * Remueve un participante de un voice channel
   */
  async removeParticipant(channelId: string, profileId: string): Promise<void> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${VOICE_PREFIX}${channelId}`;

        // Verificar que este servidor es el dueño del participante
        const data = await redis.hGet(key, profileId);
        if (data) {
          const participant = JSON.parse(data as string) as VoiceParticipant;
          if (participant.serverId === SERVER_ID) {
            await redis.hDel(key, profileId);

            // Limpiar el hash si está vacío
            const remaining = await redis.hLen(key);
            if (remaining === 0) {
              await redis.del(key);
            }

          }
        }
        // Limpiar track local
        if (this.localParticipants.has(channelId)) {
          this.localParticipants.get(channelId)!.delete(profileId);
          if (this.localParticipants.get(channelId)!.size === 0) {
            this.localParticipants.delete(channelId);
          }
        }
      } catch (error) {
        logger.error("Redis removeParticipant error:", error);
        this.removeParticipantFromMemory(channelId, profileId);
      }
    } else {
      this.removeParticipantFromMemory(channelId, profileId);
    }
  }

  /**
   * Fallback: Remueve participante de memoria
   */
  private removeParticipantFromMemory(
    channelId: string,
    profileId: string,
  ): void {
    if (this.fallbackParticipants.has(channelId)) {
      this.fallbackParticipants.get(channelId)!.delete(profileId);
      if (this.fallbackParticipants.get(channelId)!.size === 0) {
        this.fallbackParticipants.delete(channelId);
      }
    }
  }

  /**
   * Obtiene todos los participantes de un voice channel
   */
  async getParticipants(channelId: string): Promise<VoiceParticipant[]> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${VOICE_PREFIX}${channelId}`;
        const data = await redis.hGetAll(key);

        const participants: VoiceParticipant[] = [];
        for (const value of Object.values(data)) {
          try {
            participants.push(JSON.parse(value) as VoiceParticipant);
          } catch {
            // Ignorar datos malformados
          }
        }

        return participants;
      } catch (error) {
        logger.error("Redis getParticipants error:", error);
        return this.getParticipantsFromMemory(channelId);
      }
    }

    return this.getParticipantsFromMemory(channelId);
  }

  /**
   * Fallback: Obtiene participantes de memoria
   */
  private getParticipantsFromMemory(channelId: string): VoiceParticipant[] {
    const channelParticipants = this.fallbackParticipants.get(channelId);
    return channelParticipants ? Array.from(channelParticipants.values()) : [];
  }

  /**
   * Verifica si un usuario está en un voice channel específico
   */
  async isInChannel(channelId: string, profileId: string): Promise<boolean> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${VOICE_PREFIX}${channelId}`;
        const exists = await redis.hExists(key, profileId);
        return Boolean(exists);
      } catch (error) {
        logger.error("Redis isInChannel error:", error);
        return this.isInChannelMemory(channelId, profileId);
      }
    }

    return this.isInChannelMemory(channelId, profileId);
  }

  /**
   * Fallback: Verifica en memoria
   */
  private isInChannelMemory(channelId: string, profileId: string): boolean {
    const channelParticipants = this.fallbackParticipants.get(channelId);
    return channelParticipants ? channelParticipants.has(profileId) : false;
  }

  /**
   * Obtiene el conteo de participantes en un channel
   */
  async getParticipantCount(channelId: string): Promise<number> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${VOICE_PREFIX}${channelId}`;
        return await redis.hLen(key);
      } catch (error) {
        logger.error("Redis getParticipantCount error:", error);
        return this.getParticipantCountMemory(channelId);
      }
    }

    return this.getParticipantCountMemory(channelId);
  }

  /**
   * Fallback: Obtiene conteo de memoria
   */
  private getParticipantCountMemory(channelId: string): number {
    const channelParticipants = this.fallbackParticipants.get(channelId);
    return channelParticipants ? channelParticipants.size : 0;
  }

  /**
   * Limpia todos los participantes de un canal (útil para cleanup)
   */
  async clearChannel(channelId: string): Promise<void> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${VOICE_PREFIX}${channelId}`;
        await redis.del(key);
      } catch (error) {
        logger.error("Redis clearChannel error:", error);
        this.fallbackParticipants.delete(channelId);
      }
    } else {
      this.fallbackParticipants.delete(channelId);
    }

    // Limpiar track local
    this.localParticipants.delete(channelId);
  }

  /**
   * Limpia recursos al cerrar el servidor
   * Nota: No cierra Redis ya que usa clientes compartidos
   */
  async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Limpiar participantes locales de Redis antes de desconectar
    const redis = this.getRedis();
    if (redis) {
      try {
        for (const [
          channelId,
          profileIds,
        ] of this.localParticipants.entries()) {
          const key = `${VOICE_PREFIX}${channelId}`;
          for (const profileId of profileIds) {
            await redis.hDel(key, profileId);
          }
        }
      } catch (error) {
        logger.error("Redis cleanup error:", error);
      }
    }

    this.localParticipants.clear();
    this.fallbackParticipants.clear();
    logger.info("Voice participants manager cleaned up");
  }
}

// Singleton instance
export const voiceParticipantsManager = new VoiceParticipantsManager();
