import { Body, Controller, Delete, Get, Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BackupsService } from './backups.service';

interface ReqUser { sub: string; email: string; rol: string }
interface AuthedRequest extends Request { user: ReqUser }
interface MulterFile { originalname: string; buffer: Buffer; size: number; mimetype: string }

// Max 500MB upload (el mayor backup esperado está en decenas de MB)
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('backups')
export class BackupsController {
  constructor(private readonly svc: BackupsService) {}

  @Get()
  listar() {
    return this.svc.listar();
  }

  @Post()
  crear(@Req() req: AuthedRequest, @Body() body: { tipo?: string; password?: string }) {
    const tipo = (body.tipo ?? 'completo') as 'completo' | 'configuracion';
    return this.svc.crear(tipo, body.password, req.user.email);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string, @Body() body: { password?: string }) {
    return this.svc.verificar(id, body?.password);
  }

  @Post(':id/restore-test')
  restoreTest(@Param('id') id: string, @Body() body: { password?: string }) {
    return this.svc.restoreTest(id, body?.password);
  }

  @Post(':id/restore-prod')
  restoreProd(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { password?: string; confirm: string },
  ) {
    return this.svc.restoreProd(id, body?.password, body?.confirm ?? '', req.user.email);
  }

  @Get(':id/download')
  async descargar(@Param('id') id: string, @Res() res: Response) {
    const buf = await this.svc.descargarBuffer(id);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${id}"`);
    res.send(buf);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.svc.eliminar(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@Req() req: AuthedRequest, @UploadedFile() file: MulterFile) {
    return this.svc.recibirUpload({ originalname: file.originalname, buffer: file.buffer }, req.user.email);
  }
}
