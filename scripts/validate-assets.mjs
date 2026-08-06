import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(repoRoot, 'apps', 'web', 'public', 'assets');
const manifestPath = path.join(assetRoot, 'asset-manifest.json');
const ID_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;
const DIRECTIONS = new Set(['north', 'south', 'east', 'west']);
const REQUIRED_ANIMATIONS = new Set(['idle', 'walk', 'basic_attack']);

function fail(message) {
  throw new Error(`[assets] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function safeAssetPath(relativePath) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, 'asset path is empty');
  const normalized = relativePath.replaceAll('\\', '/');
  const resolved = path.resolve(assetRoot, normalized);
  assert(
    resolved === assetRoot || resolved.startsWith(`${assetRoot}${path.sep}`),
    `asset path escapes public/assets: ${relativePath}`,
  );
  return resolved;
}

async function fileSize(filePath) {
  return (await stat(filePath)).size;
}

async function pngDimensions(filePath) {
  const buffer = await readFile(filePath);
  const signature = '89504e470d0a1a0a';
  assert(buffer.subarray(0, 8).toString('hex') === signature, `invalid PNG signature: ${filePath}`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function svgDimensions(filePath) {
  const source = await readFile(filePath, 'utf8');
  const viewBox = source.match(
    /viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i,
  );
  const width = source.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i);
  const height = source.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);
  if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
  assert(width && height, `SVG has no dimensions: ${filePath}`);
  return { width: Number(width[1]), height: Number(height[1]) };
}

async function dimensions(filePath) {
  if (filePath.toLowerCase().endsWith('.png')) return pngDimensions(filePath);
  if (filePath.toLowerCase().endsWith('.svg')) return svgDimensions(filePath);
  return undefined;
}

function assertFrame(frame, label) {
  assert(
    frame && Number.isInteger(frame.width) && frame.width > 0,
    `${label}: invalid frame width`,
  );
  assert(
    frame && Number.isInteger(frame.height) && frame.height > 0,
    `${label}: invalid frame height`,
  );
  assert(
    frame && Number.isInteger(frame.count) && frame.count > 0,
    `${label}: invalid frame count`,
  );
  assert(frame.columns * frame.rows === frame.count, `${label}: frame grid/count mismatch`);
}

async function validateStaticEntry(entry, seenIds) {
  assert(entry && ID_PATTERN.test(entry.id), `invalid asset id: ${entry?.id ?? '<missing>'}`);
  assert(!seenIds.has(entry.id), `duplicate asset id: ${entry.id}`);
  seenIds.add(entry.id);
  for (const field of ['type', 'source', 'author', 'license', 'status'])
    assert(
      typeof entry[field] === 'string' && entry[field].length > 0,
      `${entry.id}: missing ${field}`,
    );
  assert(
    ['placeholder', 'generated', 'final'].includes(entry.status),
    `${entry.id}: invalid status`,
  );
  const filePath = safeAssetPath(entry.path);
  const info = await stat(filePath);
  assert(info.isFile(), `${entry.id}: path is not a file`);
  const bytes = await fileSize(filePath);
  assert(bytes <= entry.maxBytes, `${entry.id}: ${bytes} bytes exceeds ${entry.maxBytes}`);
  if (entry.dimensions) {
    const actual = await dimensions(filePath);
    assert(actual, `${entry.id}: dimensions are not supported for ${entry.path}`);
    assert(
      actual.width === entry.dimensions.width && actual.height === entry.dimensions.height,
      `${entry.id}: dimension mismatch (${actual.width}x${actual.height})`,
    );
  }
  if (entry.frame) {
    assertFrame(entry.frame, entry.id);
    assert(
      entry.dimensions.width % entry.frame.width === 0,
      `${entry.id}: width is not divisible by frame width`,
    );
    assert(
      entry.dimensions.height % entry.frame.height === 0,
      `${entry.id}: height is not divisible by frame height`,
    );
  }
}

async function validateCharacterManifest(entry, seenIds) {
  const filePath = safeAssetPath(entry.path);
  const manifest = JSON.parse(await readFile(filePath, 'utf8'));
  assert(manifest.id && ID_PATTERN.test(manifest.id), `${entry.id}: invalid character manifest id`);
  assert(manifest.id === entry.id.replace(/^character\./, ''), `${entry.id}: manifest id mismatch`);
  assert(manifest.provenance?.source === entry.source, `${entry.id}: provenance source mismatch`);
  assert(
    manifest.provenance?.license === entry.license,
    `${entry.id}: provenance license mismatch`,
  );
  assertFrame({ ...manifest.frameSize, count: 1, columns: 1, rows: 1 }, `${entry.id}: frameSize`);
  const animations = manifest.animations;
  assert(animations && typeof animations === 'object', `${entry.id}: missing animations`);
  for (const required of REQUIRED_ANIMATIONS)
    assert(animations[required], `${entry.id}: missing ${required}`);
  for (const [animationId, animation] of Object.entries(animations)) {
    assert(
      Number.isFinite(animation.frameRate) && animation.frameRate > 0,
      `${entry.id}/${animationId}: invalid frameRate`,
    );
    const directions = Object.keys(animation.frames ?? {});
    assert(directions.length > 0, `${entry.id}/${animationId}: no directions`);
    for (const direction of directions) {
      assert(
        DIRECTIONS.has(direction),
        `${entry.id}/${animationId}: invalid direction ${direction}`,
      );
      const frame = animation.frames[direction];
      assertFrame(
        {
          width: frame.frameWidth,
          height: frame.frameHeight,
          columns: frame.frameCount,
          rows: 1,
          count: frame.frameCount,
        },
        `${entry.id}/${animationId}/${direction}`,
      );
      assert(
        frame.frameWidth === manifest.frameSize.width &&
          frame.frameHeight === manifest.frameSize.height,
        `${entry.id}/${animationId}/${direction}: frame size mismatch`,
      );
      const framePath = safeAssetPath(frame.sheetPath);
      const actual = await pngDimensions(framePath);
      assert(
        actual.width === frame.frameWidth * frame.frameCount && actual.height === frame.frameHeight,
        `${entry.id}/${animationId}/${direction}: PNG dimensions ${actual.width}x${actual.height} do not match frame contract`,
      );
    }
  }
  await validateStaticEntry(
    { ...entry, id: `${entry.id}.metadata`, type: 'metadata', maxBytes: entry.maxBytes },
    seenIds,
  );
}

async function main() {
  const root = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(root.version === 'art-manifest.1', `unsupported manifest version: ${root.version}`);
  assert(Array.isArray(root.entries) && root.entries.length > 0, 'manifest has no entries');
  const seenIds = new Set();
  for (const entry of root.entries) {
    if (entry.type === 'character') await validateCharacterManifest(entry, seenIds);
    else await validateStaticEntry(entry, seenIds);
  }
  const files = await readdir(assetRoot, { recursive: true });
  const totalBytes = (
    await Promise.all(
      files
        .filter((file) => typeof file === 'string')
        .map(async (file) => {
          try {
            return await fileSize(path.join(assetRoot, file));
          } catch {
            return 0;
          }
        }),
    )
  ).reduce((sum, value) => sum + value, 0);
  assert(totalBytes <= 1_500_000, `initial art pack exceeds 1.5 MB budget: ${totalBytes}`);
  console.log(`[assets] valid: ${root.entries.length} entries, ${totalBytes} bytes`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
