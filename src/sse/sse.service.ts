import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

export type SseEventType = 'broadcast' | 'notification' | 'connected';

export interface SseEvent {
  type: SseEventType;
  data?: any;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  // Map<userUuid, { res: Response, role: string }>
  private readonly clients = new Map<string, { res: Response; role: string }>();

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
      } catch (err) {
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
   */
  sendToUser(userUuid: string, event: SseEvent): void {
    const client = this.clients.get(userUuid);
    if (client) {
      this.writeEvent(userUuid, client.res, event);
    }
  }

  /**
   * Send an event to all users with a specific role.
   */
  sendToRole(role: string, event: SseEvent): void {
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
    for (const [userUuid, client] of this.clients.entries()) {
      this.writeEvent(userUuid, client.res, event);
    }
  }

  /**
   * Returns the count of active connections.
   */
  getConnectedCount(): number {
    return this.clients.size;
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
