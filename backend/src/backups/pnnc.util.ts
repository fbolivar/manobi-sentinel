import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { encryptBuffer, decryptBuffer, sha256, EncryptionMeta } from './crypto.util';

/**
 * Formato del archivo .pnnc:
 *   Es un tar (no gz) con dos entradas:
 *     - manifest.json  (cleartext, pequeño)
 *     - payload.dat    (tar.gz de {database.dump, reportes/, ...}, opcionalmente cifrado)
 *
 * El manifest contiene los metadatos y, si está cifrado, la EncryptionMeta.
 */
export interface PnncManifest {
  version: '1.0';
  tipo: 'completo' | 'configuracion';
  creado_en: string;
  creado_por: string;
  hostname: string;
  app_version: string;
  contenido: string[];
  encrypted: boolean;
  encryption?: EncryptionMeta;
  sha256_payload: string; // del payload (antes de cifrar)
}

/** Llama a un binario y devuelve stdout/stderr. Rechaza si exit != 0. */
export function spawnP(cmd: string, args: string[], opts: { env?: NodeJS.ProcessEnv; cwd?: string; input?: Buffer } = {}): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...opts.env }, cwd: opts.cwd });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    p.stdout.on('data', (c) => outChunks.push(c));
    p.stderr.on('data', (c) => errChunks.push(c));
    p.on('error', reject);
    p.on('close', (code) => {
      const stdout = Buffer.concat(outChunks);
      const stderr = Buffer.concat(errChunks).toString('utf8');
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
    });
    if (opts.input) {
      p.stdin.write(opts.input);
      p.stdin.end();
    }
  });
}

/** Crea un directorio temporal único bajo /tmp/manobi-backup-<uuid>/. */
export async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `manobi-backup-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanup(dir: string) {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

/** pg_dump en formato custom (-Fc), restaurable con pg_restore. */
export async function pgDump(
  opts: { host: string; port: number; user: string; password: string; database: string; outFile: string },
): Promise<void> {
  await spawnP(
    'pg_dump',
    ['-h', opts.host, '-p', String(opts.port), '-U', opts.user, '-d', opts.database, '-Fc', '-f', opts.outFile],
    { env: { PGPASSWORD: opts.password } },
  );
}

/** pg_restore desde archivo custom-format. */
export async function pgRestore(
  opts: { host: string; port: number; user: string; password: string; database: string; inFile: string; clean?: boolean },
): Promise<string> {
  const args = ['-h', opts.host, '-p', String(opts.port), '-U', opts.user, '-d', opts.database];
  if (opts.clean) args.push('--clean', '--if-exists');
  args.push(opts.inFile);
  const { stderr } = await spawnP('pg_restore', args, { env: { PGPASSWORD: opts.password } }).catch((e: Error) => {
    // pg_restore puede devolver exit 1 con "warnings ignored" en --clean aunque todo haya salido bien.
    if (e.message.includes('errors ignored on restore')) return { stdout: Buffer.alloc(0), stderr: e.message };
    throw e;
  });
  return stderr;
}

/** Crea un tar.gz de un directorio. */
export async function tarGzDir(dir: string, outFile: string): Promise<void> {
  // tar -czf outFile -C dir .
  await spawnP('tar', ['-czf', outFile, '-C', dir, '.']);
}

/** Extrae un tar.gz a un directorio. */
export async function untarGz(inFile: string, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await spawnP('tar', ['-xzf', inFile, '-C', outDir]);
}

/** Crea un tar (sin gz) con los archivos dados. */
export async function tarFiles(files: { name: string; content: Buffer | string }[], outFile: string): Promise<void> {
  const tmp = await makeTempDir();
  try {
    for (const f of files) {
      const p = join(tmp, f.name);
      await writeFile(p, f.content);
    }
    await spawnP('tar', ['-cf', outFile, '-C', tmp, ...files.map((f) => f.name)]);
  } finally {
    await cleanup(tmp);
  }
}

/** Lee un tar al directorio destino. */
export async function untar(inFile: string, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await spawnP('tar', ['-xf', inFile, '-C', outDir]);
}

/**
 * Empaqueta un conjunto de archivos en .pnnc.
 *   - stagingDir: directorio que contiene los archivos a respaldar (será tar.gz'd como payload).
 *   - manifestBase: datos del manifest antes de calcular sha256.
 *   - password: si presente, el payload se cifra.
 */
export async function crearPnnc(
  stagingDir: string,
  manifestBase: Omit<PnncManifest, 'encrypted' | 'encryption' | 'sha256_payload'>,
  password: string | undefined,
): Promise<Buffer> {
  const tmp = await makeTempDir();
  try {
    const payloadGz = join(tmp, 'payload.tar.gz');
    await tarGzDir(stagingDir, payloadGz);

    let payloadBuf: Buffer = await readFile(payloadGz);
    const sha = sha256(payloadBuf);

    const manifest: PnncManifest = { ...manifestBase, encrypted: false, sha256_payload: sha };

    if (password) {
      const { ciphertext, meta } = encryptBuffer(payloadBuf, password);
      payloadBuf = ciphertext;
      manifest.encrypted = true;
      manifest.encryption = meta;
    }

    const outFile = join(tmp, 'out.pnnc');
    await tarFiles(
      [
        { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
        { name: 'payload.dat', content: payloadBuf },
      ],
      outFile,
    );

    return await readFile(outFile);
  } finally {
    await cleanup(tmp);
  }
}

/**
 * Abre un .pnnc y devuelve su manifest + payload descifrado (tar.gz listo para descomprimir).
 */
export async function abrirPnnc(
  pnncBuf: Buffer,
  password?: string,
): Promise<{ manifest: PnncManifest; payloadTarGz: Buffer }> {
  const tmp = await makeTempDir();
  try {
    const pnncFile = join(tmp, 'in.pnnc');
    await writeFile(pnncFile, pnncBuf);
    const extractDir = join(tmp, 'extract');
    await untar(pnncFile, extractDir);

    const manifestRaw = await readFile(join(extractDir, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestRaw) as PnncManifest;
    if (manifest.version !== '1.0') {
      throw new Error(`Version del .pnnc no soportada: ${manifest.version}`);
    }

    let payload: Buffer = await readFile(join(extractDir, 'payload.dat'));

    if (manifest.encrypted) {
      if (!password) throw new Error('Este backup está cifrado. Se requiere contraseña.');
      if (!manifest.encryption) throw new Error('Manifest incompleto: falta bloque encryption.');
      payload = decryptBuffer(payload, password, manifest.encryption);
    }

    const sha = sha256(payload);
    if (sha !== manifest.sha256_payload) {
      throw new Error('Checksum inválido: el archivo puede estar corrupto.');
    }

    return { manifest, payloadTarGz: payload };
  } finally {
    await cleanup(tmp);
  }
}
