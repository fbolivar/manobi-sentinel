import { BadRequestException, ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { hostname } from 'node:os';
import { readdir, stat, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BACKUPS_BUCKET, BACKUPS_MINIO_CLIENT } from './minio.provider';
import { abrirPnnc, cleanup, crearPnnc, makeTempDir, pgDump, pgRestore, untarGz, PnncManifest, spawnP } from './pnnc.util';

export interface BackupListItem {
  id: string;           // objectName en MinIO
  filename: string;
  size: number;
  tipo: string;
  creado_en: string;
  creado_por: string;
  encrypted: boolean;
  app_version: string;
}

const APP_VERSION = '0.4.2';

@Injectable()
export class BackupsService {
  private readonly log = new Logger('Backups');

  constructor(
    @Inject(BACKUPS_MINIO_CLIENT) private readonly minio: MinioClient,
    private readonly cfg: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Listar backups en MinIO
  // ---------------------------------------------------------------------------
  async listar(): Promise<BackupListItem[]> {
    const items: BackupListItem[] = [];
    const stream = this.minio.listObjectsV2(BACKUPS_BUCKET, '', true);
    const keys: { name: string; size: number }[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => keys.push({ name: obj.name!, size: obj.size ?? 0 }));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    for (const k of keys) {
      try {
        const stat = await this.minio.statObject(BACKUPS_BUCKET, k.name);
        const meta = stat.metaData ?? {};
        items.push({
          id: k.name,
          filename: k.name,
          size: k.size,
          tipo: meta['tipo'] ?? 'desconocido',
          creado_en: meta['creado-en'] ?? '',
          creado_por: meta['creado-por'] ?? '',
          encrypted: meta['encrypted'] === 'true',
          app_version: meta['app-version'] ?? '',
        });
      } catch {
        items.push({ id: k.name, filename: k.name, size: k.size, tipo: '?', creado_en: '', creado_por: '', encrypted: false, app_version: '' });
      }
    }
    items.sort((a, b) => (b.creado_en || '').localeCompare(a.creado_en || ''));
    return items;
  }

  // ---------------------------------------------------------------------------
  // Crear un backup y subirlo a MinIO
  // ---------------------------------------------------------------------------
  async crear(
    tipo: 'completo' | 'configuracion',
    password: string | undefined,
    usuarioEmail: string,
  ): Promise<BackupListItem> {
    if (tipo !== 'completo' && tipo !== 'configuracion') {
      throw new BadRequestException(`Tipo inválido: ${tipo}`);
    }
    if (tipo === 'configuracion') {
      throw new BadRequestException('Tipo configuracion aún no implementado');
    }
    const staging = await makeTempDir();
    try {
      // 1. pg_dump
      const dbDump = join(staging, 'database.dump');
      const db = this.cfg.get<{ host: string; port: number; user: string; password: string; database: string }>('db')!;
      this.log.log(`[${tipo}] pg_dump de ${db.database}@${db.host} iniciado por ${usuarioEmail}`);
      await pgDump({ ...db, outFile: dbDump });
      const dumpSize = (await stat(dbDump)).size;
      this.log.log(`pg_dump OK (${(dumpSize / 1024 / 1024).toFixed(1)} MB)`);

      // 2. Si es completo, incluir reportes
      const contenido = ['database'];
      if (tipo === 'completo') {
        const reportesDir = join(staging, 'reportes');
        await mkdir(reportesDir, { recursive: true });
        const bucketReportes = this.cfg.get<string>('minio.bucketReportes')!;
        let cnt = 0;
        const stream = this.minio.listObjectsV2(bucketReportes, '', true);
        const names: string[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (o) => o.name && names.push(o.name));
          stream.on('end', () => resolve());
          stream.on('error', reject);
        });
        for (const n of names) {
          try {
            const s = await this.minio.getObject(bucketReportes, n);
            const chunks: Buffer[] = [];
            for await (const c of s) chunks.push(c as Buffer);
            await writeFile(join(reportesDir, n), Buffer.concat(chunks));
            cnt++;
          } catch (e) {
            this.log.warn(`No se pudo copiar reporte ${n}: ${(e as Error).message}`);
          }
        }
        this.log.log(`Copiados ${cnt} reportes de MinIO al staging`);
        if (cnt > 0) contenido.push('reportes');
      }

      // 3. Empaquetar .pnnc (con cifrado opcional)
      const manifest: Omit<PnncManifest, 'encrypted' | 'encryption' | 'sha256_payload'> = {
        version: '1.0',
        tipo,
        creado_en: new Date().toISOString(),
        creado_por: usuarioEmail,
        hostname: hostname(),
        app_version: APP_VERSION,
        contenido,
      };
      const pnncBuf = await crearPnnc(staging, manifest, password);
      this.log.log(`.pnnc creado (${(pnncBuf.length / 1024 / 1024).toFixed(1)} MB)${password ? ' [cifrado]' : ''}`);

      // 4. Subir a MinIO con metadata
      const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const objectName = `backup-manobi-${tipo}-${fecha}${password ? '-enc' : ''}.pnnc`;
      const metaData = {
        'Content-Type': 'application/octet-stream',
        'tipo': tipo,
        'creado-en': manifest.creado_en,
        'creado-por': usuarioEmail,
        'encrypted': password ? 'true' : 'false',
        'app-version': APP_VERSION,
      };
      await this.minio.putObject(BACKUPS_BUCKET, objectName, pnncBuf, pnncBuf.length, metaData);
      this.log.log(`Backup ${objectName} subido a MinIO`);

      return {
        id: objectName,
        filename: objectName,
        size: pnncBuf.length,
        tipo,
        creado_en: manifest.creado_en,
        creado_por: usuarioEmail,
        encrypted: !!password,
        app_version: APP_VERSION,
      };
    } finally {
      await cleanup(staging);
    }
  }

  // ---------------------------------------------------------------------------
  // Descargar .pnnc desde MinIO
  // ---------------------------------------------------------------------------
  async descargarBuffer(id: string): Promise<Buffer> {
    try {
      const stream = await this.minio.getObject(BACKUPS_BUCKET, id);
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c as Buffer);
      return Buffer.concat(chunks);
    } catch (e) {
      throw new NotFoundException(`Backup no encontrado: ${id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Validar manifest + checksum + password (si aplica). NO restaura nada.
  // ---------------------------------------------------------------------------
  async verificar(id: string, password?: string): Promise<PnncManifest> {
    const buf = await this.descargarBuffer(id);
    try {
      const { manifest } = await abrirPnnc(buf, password);
      return manifest;
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  // ---------------------------------------------------------------------------
  // Restaurar en DB temporal para validación (safe)
  // ---------------------------------------------------------------------------
  async restoreTest(id: string, password?: string): Promise<Record<string, unknown>> {
    const buf = await this.descargarBuffer(id);
    const opened = await abrirPnnc(buf, password).catch((e: Error) => { throw new BadRequestException(e.message); });
    const { manifest, payloadTarGz } = opened;

    const workDir = await makeTempDir();
    try {
      const payloadFile = join(workDir, 'payload.tar.gz');
      await writeFile(payloadFile, payloadTarGz);
      const extract = join(workDir, 'extract');
      await untarGz(payloadFile, extract);

      const db = this.cfg.get<{ host: string; port: number; user: string; password: string; database: string }>('db')!;
      const testDb = `manobi_pnnc_test_${Date.now()}`;

      this.log.log(`restore-test: creando DB temporal ${testDb}`);
      await spawnP(
        'psql',
        ['-h', db.host, '-p', String(db.port), '-U', db.user, '-d', 'postgres', '-c', `CREATE DATABASE ${testDb}`],
        { env: { PGPASSWORD: db.password } },
      );

      try {
        await pgRestore({ ...db, database: testDb, inFile: join(extract, 'database.dump'), clean: false });
        // Validar counts
        const { stdout } = await spawnP(
          'psql',
          ['-h', db.host, '-p', String(db.port), '-U', db.user, '-d', testDb, '-tAc',
            `SELECT json_object_agg(t, c) FROM (
               SELECT 'parques' AS t, COUNT(*) AS c FROM parques
               UNION ALL SELECT 'alertas', COUNT(*) FROM alertas
               UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
               UNION ALL SELECT 'reglas', COUNT(*) FROM reglas_alerta
               UNION ALL SELECT 'predicciones', COUNT(*) FROM predicciones
               UNION ALL SELECT 'eventos', COUNT(*) FROM eventos_climaticos
             ) x`],
          { env: { PGPASSWORD: db.password } },
        );
        const counts = JSON.parse(stdout.toString('utf8').trim()) as Record<string, number>;
        return { manifest, counts };
      } finally {
        await spawnP(
          'psql',
          ['-h', db.host, '-p', String(db.port), '-U', db.user, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${testDb}`],
          { env: { PGPASSWORD: db.password } },
        ).catch(() => undefined);
      }
    } finally {
      await cleanup(workDir);
    }
  }

  // ---------------------------------------------------------------------------
  // Restaurar a PRODUCCIÓN. Peligroso, requiere confirmación.
  // ---------------------------------------------------------------------------
  async restoreProd(id: string, password: string | undefined, confirmText: string, usuarioEmail: string): Promise<{ ok: true; manifest: PnncManifest; reportes_restaurados: number }> {
    if (confirmText !== 'CONFIRMAR PRODUCCION') {
      throw new ForbiddenException('Confirmación incorrecta. Debe escribir exactamente: CONFIRMAR PRODUCCION');
    }
    const buf = await this.descargarBuffer(id);
    const opened = await abrirPnnc(buf, password).catch((e: Error) => { throw new BadRequestException(e.message); });
    const { manifest, payloadTarGz } = opened;
    this.log.warn(`!!! RESTORE PROD iniciado por ${usuarioEmail} — backup ${id} (${manifest.creado_en})`);

    const workDir = await makeTempDir();
    try {
      const payloadFile = join(workDir, 'payload.tar.gz');
      await writeFile(payloadFile, payloadTarGz);
      const extract = join(workDir, 'extract');
      await untarGz(payloadFile, extract);

      const db = this.cfg.get<{ host: string; port: number; user: string; password: string; database: string }>('db')!;
      this.log.warn(`pg_restore --clean --if-exists en DB ${db.database}...`);
      await pgRestore({ ...db, inFile: join(extract, 'database.dump'), clean: true });
      this.log.warn('pg_restore completado OK');

      // Restaurar reportes a MinIO (si los trae)
      let reportesRestaurados = 0;
      try {
        const reportesDir = join(extract, 'reportes');
        const files = await readdir(reportesDir).catch(() => [] as string[]);
        if (files.length > 0) {
          const bucketReportes = this.cfg.get<string>('minio.bucketReportes')!;
          for (const f of files) {
            const content = await readFile(join(reportesDir, f));
            await this.minio.putObject(bucketReportes, f, content, content.length).catch(() => undefined);
            reportesRestaurados++;
          }
          this.log.warn(`Reportes restaurados a MinIO: ${reportesRestaurados}`);
        }
      } catch (e) {
        this.log.warn(`Error restaurando reportes: ${(e as Error).message}`);
      }

      this.log.warn(`!!! RESTORE PROD completado OK`);
      return { ok: true, manifest, reportes_restaurados: reportesRestaurados };
    } finally {
      await cleanup(workDir);
    }
  }

  // ---------------------------------------------------------------------------
  // Eliminar un backup
  // ---------------------------------------------------------------------------
  async eliminar(id: string): Promise<{ ok: true }> {
    await this.minio.removeObject(BACKUPS_BUCKET, id);
    this.log.log(`Backup eliminado: ${id}`);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Recibir un .pnnc externo y guardarlo en MinIO
  // ---------------------------------------------------------------------------
  async recibirUpload(file: { originalname: string; buffer: Buffer }, usuarioEmail: string): Promise<BackupListItem> {
    if (!file.originalname.endsWith('.pnnc')) {
      throw new BadRequestException('Solo se aceptan archivos .pnnc');
    }
    // Validar que al menos tenga manifest legible
    const { manifest } = await abrirPnnc(file.buffer).catch((e: Error) => {
      if (e.message.includes('contraseña')) return { manifest: null as unknown as PnncManifest };
      throw new BadRequestException(`Archivo inválido: ${e.message}`);
    });

    const metaData: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'subido-por': usuarioEmail,
    };
    if (manifest) {
      metaData['tipo'] = manifest.tipo;
      metaData['creado-en'] = manifest.creado_en;
      metaData['creado-por'] = manifest.creado_por;
      metaData['encrypted'] = manifest.encrypted ? 'true' : 'false';
      metaData['app-version'] = manifest.app_version;
    } else {
      metaData['encrypted'] = 'true';
      metaData['tipo'] = 'desconocido';
    }

    const id = `upload-${Date.now()}-${file.originalname}`;
    await this.minio.putObject(BACKUPS_BUCKET, id, file.buffer, file.buffer.length, metaData);
    this.log.log(`Upload recibido: ${id} (${file.buffer.length} bytes) por ${usuarioEmail}`);

    return {
      id,
      filename: file.originalname,
      size: file.buffer.length,
      tipo: manifest?.tipo ?? 'desconocido',
      creado_en: manifest?.creado_en ?? '',
      creado_por: manifest?.creado_por ?? usuarioEmail,
      encrypted: manifest?.encrypted ?? true,
      app_version: manifest?.app_version ?? '',
    };
  }
}
