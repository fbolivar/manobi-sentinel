import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BurntAreasService } from './burnt-areas.service';

@ApiTags('burnt-areas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('burnt-areas')
export class BurntAreasController {
  constructor(private readonly svc: BurntAreasService) {}

  @Get()
  async findByRange(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const now = new Date();
    const defaultDesde = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const features = await this.svc.findByRange(
      desde ?? defaultDesde,
      hasta ?? now.toISOString(),
    );
    return this.svc.summarize(features);
  }
}
