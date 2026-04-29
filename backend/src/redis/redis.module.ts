import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_SUB = 'REDIS_SUB';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new Redis({
          host: cfg.get<string>('redis.host'),
          port: cfg.get<number>('redis.port'),
          password: cfg.get<string>('redis.password'),
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        }),
    },
    {
      provide: REDIS_SUB,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new Redis({
          host: cfg.get<string>('redis.host'),
          port: cfg.get<number>('redis.port'),
          password: cfg.get<string>('redis.password'),
        }),
    },
  ],
  exports: [REDIS_CLIENT, REDIS_SUB],
})
export class RedisModule {}
