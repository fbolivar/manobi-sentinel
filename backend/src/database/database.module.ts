import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Entities from '../common/entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('db.host'),
        port: cfg.get<number>('db.port'),
        username: cfg.get<string>('db.user'),
        password: cfg.get<string>('db.password'),
        database: cfg.get<string>('db.database'),
        entities: Object.values(Entities),
        synchronize: false,
        logging: cfg.get<string>('node_env') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
