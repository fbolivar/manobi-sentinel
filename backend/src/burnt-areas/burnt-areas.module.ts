import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BurntAreasController } from './burnt-areas.controller';
import { BurntAreasService } from './burnt-areas.service';

@Module({
  imports: [HttpModule.register({ timeout: 30_000 })],
  controllers: [BurntAreasController],
  providers: [BurntAreasService],
})
export class BurntAreasModule {}
