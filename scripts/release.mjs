import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const numberPattern = /^[1-9][0-9]*$/;
export const digest = data => createHash('sha256').update(data).digest('hex');

export async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    if (!/^[A-Za-z0-9_.-]+$/.test(entry.name)) throw new Error(`Nom de fichier non pris en charge : ${entry.name}`);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(directory, relative));
    else if (entry.isFile()) result.push(relative);
    else throw new Error(`Lien symbolique ou fichier spécial interdit : ${relative}`);
  }
  return result.sort();
}

export async function createRelease(source, destination, { sha, runId, attempt }) {
  if (!shaPattern.test(sha) || !numberPattern.test(runId) || !numberPattern.test(attempt)) {
    throw new Error('Identité de version GitHub invalide.');
  }
  // Every workflow attempt has a separate directory, including retries.
  const releaseId = `${sha}-${runId}-${attempt}`;
  const site = path.join(destination, 'site');
  await mkdir(destination, { recursive: true });
  // Refuse to mix this release with previous output.
  await mkdir(site);
  for (const filename of await listFiles(source)) {
    const target = filename === 'index.html' || filename === '.htaccess'
      ? filename : `releases/${releaseId}/${filename}`;
    await mkdir(path.dirname(path.join(site, target)), { recursive: true });
    if (filename === 'index.html') {
      let html = await readFile(path.join(source, filename), 'utf8');
      html = html.replace(/\b(href|src)="\.\//g, `$1="./releases/${releaseId}/`);
      html = html.replace('</head>', `  <meta name="hugoli-release" content="${releaseId}">\n  </head>`);
      await writeFile(path.join(site, target), html);
    } else await cp(path.join(source, filename), path.join(site, target));
  }
  const files = {};
  for (const filename of await listFiles(site)) files[filename] = digest(await readFile(path.join(site, filename)));
  const manifest = { schema: 1, sha, runId, attempt, releaseId, files };
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export async function verifyRelease(directory, expected = {}) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || !shaPattern.test(manifest.sha)
    || !numberPattern.test(manifest.runId) || !numberPattern.test(manifest.attempt)
    || manifest.releaseId !== `${manifest.sha}-${manifest.runId}-${manifest.attempt}`) {
    throw new Error('Manifeste de version invalide.');
  }
  for (const key of ['sha', 'runId', 'attempt']) {
    if (expected[key] !== undefined && manifest[key] !== expected[key]) throw new Error(`La version ne correspond pas à ${key}.`);
  }
  const files = await listFiles(path.join(directory, 'site'));
  const declared = Object.keys(manifest.files).sort();
  if (JSON.stringify(files) !== JSON.stringify(declared) || !files.includes('index.html') || !files.includes('.htaccess')) {
    throw new Error('Liste de fichiers incohérente.');
  }
  for (const filename of files) {
    if (!['index.html', '.htaccess'].includes(filename) && !filename.startsWith(`releases/${manifest.releaseId}/`)) {
      throw new Error('Fichier en dehors du répertoire de version.');
    }
    if (digest(await readFile(path.join(directory, 'site', filename))) !== manifest.files[filename]) {
      throw new Error(`Empreinte incorrecte : ${filename}`);
    }
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await createRelease('dist', process.argv[2] ?? 'artifacts/release', {
    sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
  });
  console.log(`Version préparée : ${manifest.releaseId}`);
}
