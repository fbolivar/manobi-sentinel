import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { PushService, PushSubscriptionJSON } from './push.service';

class RegisterPushDto {
  @IsObject() subscription!: PushSubscriptionJSON;
  @IsArray() @IsIn(['verde', 'amarillo', 'rojo'], { each: true }) niveles!: ('verde' | 'amarillo' | 'rojo')[];
  @IsOptional() @IsUUID() parque_id?: string;
}

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly svc: PushService) {}

  @Public()
  @Get('vapid-public-key')
  publicKey() { return { key: this.svc.publicKey() }; }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@Body() dto: RegisterPushDto, @CurrentUser() u: JwtUser) {
    return this.svc.registerSubscription(u.sub, dto.subscription, dto.niveles, dto.parque_id);
  }
}
