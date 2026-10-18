import { readFile, appendFile } from 'node:fs/promises';
import { verifyRelease, listFiles } from './release.mjs';

const directory = process.argv[2] ?? 'artifacts/release';
const manifest = await verifyRelease(directory, {
  sha: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  attempt: process.env.GITHUB_RUN_ATTEMPT,
});
const repository = process.env.GITHUB_REPOSITORY;
if (repository !== 'HugoFram/hugoliwedding') throw new Error('Dépôt inattendu.');
if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Publication réservée à main.');
const branch = 'site-test'; // Production is deliberately not implemented yet.

async function api(endpoint, method = 'GET', body, allowMissing = false) {
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}`);
  return response.json();
}

const previous = await api(`/git/ref/heads/${branch}`, 'GET', undefined, true);
const entries = [];
for (const filename of await listFiles(directory)) {
  const blob = await api('/git/blobs', 'POST', { content: (await readFile(`${directory}/${filename}`)).toString('base64'), encoding: 'base64' });
  entries.push({ path: filename, mode: '100644', type: 'blob', sha: blob.sha });
}
const tree = await api('/git/trees', 'POST', { tree: entries });
const commit = await api('/git/commits', 'POST', {
  message: `Publish test ${manifest.releaseId}`,
  tree: tree.sha,
  parents: [previous?.object.sha ?? process.env.GITHUB_SHA],
});
if (previous) await api(`/git/refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: false });
else await api('/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha });
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `### Version de test préparée pour le Raspberry Pi\n\nVersion : \`${manifest.releaseId}\`\n\nLe Pi récupère cette version automatiquement (environ 30 secondes).\n\nProduction désactivée jusqu’à validation.\n`);
console.log(`Version de test publiée : ${manifest.releaseId}`);
