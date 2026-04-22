import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Response } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

export type SseEventType = 'broadcast' | 'notification' | 'connected';

export interface SseEvent {
  type: SseEventType;
  data?: any;
}

type PubSubPayload =
  | { type: 'toUser'; targetId: string; event: SseEvent }
  | { type: 'toRole'; targetId: string; event: SseEvent }
  | { type: 'toAll'; event: SseEvent };

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  // Map<userUuid, { res: Response, role: string }>
  private readonly clients = new Map<string, { res: Response; role: string }>();
  private readonly CHANNEL = 'sse:events';
  private subscriber: Redis | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {
    if (this.redisClient) {
      // Redis mode: duplicate the client for subscribe (a pub/sub connection
      // cannot issue regular commands concurrently).
      this.subscriber = this.redisClient.duplicate();
      void this.subscriber.subscribe(this.CHANNEL);
      this.subscriber.on('message', (_ch: string, msg: string) => {
        try {
          const payload = JSON.parse(msg) as PubSubPayload;
          this.deliverLocally(payload);
        } catch (err) {
          this.logger.error(
            `Failed to parse SSE Redis message: ${(err as Error).message}`,
          );
        }
      });
      this.logger.log('[SSE] Redis pub/sub mode active');
    } else {
      this.logger.log('[SSE] In-memory mode (single process)');
    }
  }

  onModuleDestroy(): void {
    if (this.subscriber) {
      void this.subscriber.quit();
      this.subscriber = null;
    }
  }

  /**
   * Register a new SSE client connection.
   * Maintains a single connection per user (last one wins).
   */
  addClient(userUuid: string, role: string, res: Response): void {
    const existing = this.clients.get(userUuid);
    if (existing) {
      this.logger.debug(`Closing previous connection for user ${userUuid}`);
      try {
        existing.res.end();
      } catch {
        // Ignore errors when closing old connection
      }
    }

    this.clients.set(userUuid, { res, role });
    this.logger.log(
      `Client added: ${userUuid} (${role}). Total clients: ${this.clients.size}`,
    );
  }

  /**
   * Remove a client connection by user UUID.
   */
  removeClient(userUuid: string): void {
    if (this.clients.has(userUuid)) {
      this.clients.delete(userUuid);
      this.logger.log(
        `Client removed: ${userUuid}. Total clients: ${this.clients.size}`,
      );
    }
  }

  /**
   * Send an event to a specific user.
   * In Redis mode: publishes to channel so the owning instance delivers.
   * In memory mode: delivers directly if user is connected to this process.
   */
  sendToUser(userUuid: string, event: SseEvent): void {
    if (this.redisClient) {
      void this.redisClient.publish(
        this.CHANNEL,
        JSON.stringify({ type: 'toUser', targetId: userUuid, event }),
      );
      return;
    }
    const client = this.clients.get(userUuid);
    if (client) {
      this.writeEvent(userUuid, client.res, event);
    }
  }

  /**
   * Send an event to all users with a specific role.
   */
  sendToRole(role: string, event: SseEvent): void {
    if (this.redisClient) {
      void this.redisClient.publish(
        this.CHANNEL,
        JSON.stringify({ type: 'toRole', targetId: role, event }),
      );
      return;
    }
    for (const [userUuid, client] of this.clients.entries()) {
      if (client.role === role) {
        this.writeEvent(userUuid, client.res, event);
      }
    }
  }

  /**
   * Send an event to all connected clients.
   */
  sendToAll(event: SseEvent): void {
    if (this.redisClient) {
      void this.redisClient.publish(
        this.CHANNEL,
        JSON.stringify({ type: 'toAll', event }),
      );
      return;
    }
    for (const [userUuid, client] of this.clients.entries()) {
      this.writeEvent(userUuid, client.res, event);
    }
  }

  /**
   * Returns the count of active connections on this process.
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Local delivery — invoked either directly (in-memory mode) or from a
   * Redis pub/sub message (cluster mode). Only writes to sockets held
   * by THIS process.
   */
  private deliverLocally(payload: PubSubPayload): void {
    if (payload.type === 'toUser') {
      const client = this.clients.get(payload.targetId);
      if (client) {
        this.writeEvent(payload.targetId, client.res, payload.event);
      }
      return;
    }
    if (payload.type === 'toRole') {
      for (const [userUuid, client] of this.clients.entries()) {
        if (client.role === payload.targetId) {
          this.writeEvent(userUuid, client.res, payload.event);
        }
      }
      return;
    }
    // toAll
    for (const [userUuid, client] of this.clients.entries()) {
      this.writeEvent(userUuid, client.res, payload.event);
    }
  }

  /**
   * Helper to write raw SSE format to the response stream.
   * Format: data: {"type":"...","data":{...}}\n\n
   */
  private writeEvent(userUuid: string, res: Response, event: SseEvent): void {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      this.logger.error(
        `Failed to send SSE event to ${userUuid}: ${(error as Error).message}`,
      );
      // Prune zombie Map entry — write failure means the socket is dead.
      this.clients.delete(userUuid);
    }
  }
}
