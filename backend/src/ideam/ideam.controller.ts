import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { IdeamService } from './ideam.service';
import { FirmsService } from './firms.service';

@ApiTags('ideam')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ideam')
export class IdeamController {
  constructor(
    private readonly svc: IdeamService,
    private readonly firms: FirmsService,
  ) {}

  @Roles('admin', 'operador')
  @Post('poll')
  pollNow() { return this.svc.pollNow(); }

  @Roles('admin', 'operador')
  @Post('firms')
  firmsPoll() { return this.firms.pollNow(); }
}
