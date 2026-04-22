import { Global, Logger, Module, Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const logger = new Logger('RedisModule');
    const enabled = process.env.REDIS_ENABLED === 'true';
    if (!enabled) {
      logger.log('REDIS_ENABLED=false — skipping Redis client (in-memory fallback)');
      return null;
    }
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new Redis(url);
    client.on('error', (err) => logger.error(`Connection error: ${err.message}`));
    client.on('connect', () => logger.log(`Connected to ${url}`));
    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
