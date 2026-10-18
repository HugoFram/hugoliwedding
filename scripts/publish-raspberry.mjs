import { readFile, appendFile } from 'node:fs/promises';
import { verifyRelease, listFiles } from './release.mjs';

const directory = process.argv[2] ?? 'artifacts/release';
const environment = process.argv[3] ?? 'test';
if (!['test', 'production'].includes(environment)) throw new Error('Destination inconnue.');
if (environment === 'production' && (!process.env.SOURCE_SHA || !process.env.SOURCE_RUN_ID || !process.env.SOURCE_ATTEMPT)) {
  throw new Error('La production exige l’identité d’une exécution de test validée.');
}
const manifest = await verifyRelease(directory, {
  sha: environment === 'test' ? process.env.GITHUB_SHA : process.env.SOURCE_SHA,
  runId: environment === 'test' ? process.env.GITHUB_RUN_ID : process.env.SOURCE_RUN_ID,
  attempt: environment === 'test' ? process.env.GITHUB_RUN_ATTEMPT : process.env.SOURCE_ATTEMPT,
});
const repository = process.env.GITHUB_REPOSITORY;
if (repository !== 'HugoFram/hugoliwedding') throw new Error('Dépôt inattendu.');
if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Publication réservée à main.');
if (environment === 'production' && process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
  throw new Error('La promotion en production doit être lancée manuellement.');
}
const branch = environment === 'test' ? 'site-test' : 'site-production';

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
  message: `Publish ${environment} ${manifest.releaseId}`,
  tree: tree.sha,
  parents: [previous?.object.sha ?? process.env.GITHUB_SHA],
});
if (previous) await api(`/git/refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: false });
else await api('/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha });
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `### Version ${environment} préparée pour le Raspberry Pi\n\nVersion : \`${manifest.releaseId}\`\n\n[Test source ${manifest.runId}](https://github.com/${repository}/actions/runs/${manifest.runId})\n\nLe Pi récupère cette version automatiquement (environ 30 secondes).\n`);
console.log(`Version ${environment} publiée : ${manifest.releaseId}`);
