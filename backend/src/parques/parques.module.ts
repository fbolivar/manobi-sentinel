import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parque } from '../common/entities/parque.entity';
import { ParquesController } from './parques.controller';
import { ParquesService } from './parques.service';

@Module({
  imports: [TypeOrmModule.forFeature([Parque])],
  controllers: [ParquesController],
  providers: [ParquesService],
  exports: [ParquesService],
})
export class ParquesModule {}
