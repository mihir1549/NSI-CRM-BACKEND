import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { SseService, type SseEvent } from './sse.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

// Minimal Response stub — only what writeEvent needs
function mockResponse(): Response {
  const res = {
    write: jest.fn(),
    end: jest.fn(),
  };
  return res as unknown as Response;
}

describe('SseService', () => {
  describe('in-memory mode (REDIS_CLIENT = null)', () => {
    let service: SseService;

    beforeEach(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          SseService,
          { provide: REDIS_CLIENT, useValue: null },
        ],
      }).compile();

      service = moduleRef.get<SseService>(SseService);
    });

    it('addClient stores the connection and getConnectedCount reflects it', () => {
      const res = mockResponse();
      service.addClient('user-1', 'CUSTOMER', res);
      expect(service.getConnectedCount()).toBe(1);
    });

    it('addClient replaces prior connection for same user (last-wins)', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      service.addClient('user-1', 'CUSTOMER', res1);
      service.addClient('user-1', 'CUSTOMER', res2);
      expect(res1.end).toHaveBeenCalled();
      expect(service.getConnectedCount()).toBe(1);
    });

    it('removeClient deletes the entry', () => {
      const res = mockResponse();
      service.addClient('user-1', 'CUSTOMER', res);
      service.removeClient('user-1');
      expect(service.getConnectedCount()).toBe(0);
    });

    it('sendToUser writes to the right client only', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      service.addClient('user-1', 'CUSTOMER', res1);
      service.addClient('user-2', 'CUSTOMER', res2);

      const event: SseEvent = { type: 'notification', data: { msg: 'hi' } };
      service.sendToUser('user-1', event);

      expect(res1.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(event)}\n\n`,
      );
      expect(res2.write).not.toHaveBeenCalled();
    });

    it('sendToUser is a no-op when user not connected', () => {
      const event: SseEvent = { type: 'notification' };
      expect(() => service.sendToUser('ghost', event)).not.toThrow();
    });

    it('sendToRole writes only to clients with matching role', () => {
      const resCust = mockResponse();
      const resDist = mockResponse();
      service.addClient('user-c', 'CUSTOMER', resCust);
      service.addClient('user-d', 'DISTRIBUTOR', resDist);

      const event: SseEvent = { type: 'broadcast', data: { scope: 'dist' } };
      service.sendToRole('DISTRIBUTOR', event);

      expect(resDist.write).toHaveBeenCalledTimes(1);
      expect(resCust.write).not.toHaveBeenCalled();
    });

    it('sendToAll writes to every connected client', () => {
      const res1 = mockResponse();
      const res2 = mockResponse();
      service.addClient('user-1', 'CUSTOMER', res1);
      service.addClient('user-2', 'ADMIN', res2);

      const event: SseEvent = { type: 'broadcast' };
      service.sendToAll(event);

      expect(res1.write).toHaveBeenCalledTimes(1);
      expect(res2.write).toHaveBeenCalledTimes(1);
    });

    it('prunes zombie client on write failure', () => {
      const res = mockResponse();
      (res.write as jest.Mock).mockImplementation(() => {
        throw new Error('EPIPE');
      });
      service.addClient('user-1', 'CUSTOMER', res);

      service.sendToUser('user-1', { type: 'notification' });

      expect(service.getConnectedCount()).toBe(0);
    });
  });

  describe('Redis mode (REDIS_CLIENT = mock)', () => {
    let service: SseService;
    let publish: jest.Mock;
    let subscriberOn: jest.Mock;

    beforeEach(async () => {
      publish = jest.fn().mockResolvedValue(1);
      subscriberOn = jest.fn();
      const subscriber = {
        subscribe: jest.fn().mockResolvedValue(undefined),
        on: subscriberOn,
        quit: jest.fn().mockResolvedValue(undefined),
      };
      const mockRedis = {
        publish,
        duplicate: jest.fn().mockReturnValue(subscriber),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          SseService,
          { provide: REDIS_CLIENT, useValue: mockRedis },
        ],
      }).compile();

      service = moduleRef.get<SseService>(SseService);
    });

    it('sendToUser publishes a toUser payload to the sse:events channel', () => {
      const event: SseEvent = { type: 'notification', data: { a: 1 } };
      service.sendToUser('user-1', event);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(
        'sse:events',
        expect.stringContaining('"type":"toUser"'),
      );
      const payload = JSON.parse((publish.mock.calls[0][1]) as string);
      expect(payload.targetId).toBe('user-1');
      expect(payload.event).toEqual(event);
    });

    it('sendToRole publishes a toRole payload', () => {
      const event: SseEvent = { type: 'broadcast' };
      service.sendToRole('ADMIN', event);
      expect(publish).toHaveBeenCalledWith(
        'sse:events',
        expect.stringContaining('"type":"toRole"'),
      );
    });

    it('sendToAll publishes a toAll payload', () => {
      const event: SseEvent = { type: 'broadcast' };
      service.sendToAll(event);
      expect(publish).toHaveBeenCalledWith(
        'sse:events',
        expect.stringContaining('"type":"toAll"'),
      );
    });

    it('subscribes to the sse:events channel on construction', () => {
      expect(subscriberOn).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });
});
