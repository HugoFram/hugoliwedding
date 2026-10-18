import { targets } from './deploy-sftp.mjs';
import { digest, verifyRelease } from './release.mjs';

const target = targets[process.argv[2]];
if (!target) throw new Error('Destination inconnue.');
const manifest = await verifyRelease(process.argv[3] ?? 'artifacts/release');
const base = new URL(target.url);

// Verify actual HTML and resources over HTTPS, with certificate checks enabled.
for (const [filename, expectedDigest] of Object.entries(manifest.files)) {
  if (filename === '.htaccess') continue; // Apache intentionally does not expose this file.
  const url = new URL(filename, base);
  url.searchParams.set('hugoli-check', manifest.releaseId);
  let verified = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (filename.endsWith('.mjs') && !/^(text|application)\/javascript\b/.test(response.headers.get('content-type') ?? '')) {
        throw new Error('Type MIME JavaScript incorrect.');
      }
      if (digest(Buffer.from(await response.arrayBuffer())) !== expectedDigest) throw new Error('Fichier différent de la version attendue.');
      verified = true;
      break;
    } catch (error) {
      if (attempt === 3) throw new Error(`${filename} : ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  if (!verified) throw new Error(`Échec de vérification : ${filename}`);
}
console.log(`HTTPS vérifié : ${target.url} — ${manifest.releaseId}`);
