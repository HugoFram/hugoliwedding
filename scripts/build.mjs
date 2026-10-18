import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(root, 'dist');
// Verify the absolute target before recursively clearing build output.
if (path.dirname(destination) !== path.resolve(root) || path.basename(destination) !== 'dist') {
  throw new Error('Répertoire de sortie inattendu.');
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(path.join(root, 'public'), destination, { recursive: true });
console.log('Site prêt dans dist/.');
