import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateRun(run, repository) {
  if (run.repository?.full_name !== repository || run.head_repository?.full_name !== repository
    || run.path !== '.github/workflows/deploy-test.yml' || run.head_branch !== 'main'
    || !['push', 'workflow_dispatch'].includes(run.event)
    || run.status !== 'completed' || run.conclusion !== 'success'
    || !/^[a-f0-9]{40}$/.test(run.head_sha) || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
    throw new Error('Choisir une exécution réussie du workflow de test sur main, dans ce dépôt.');
  }
  return { sha: run.head_sha, attempt: String(run.run_attempt) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runId = process.argv[2];
  if (!/^[1-9][0-9]*$/.test(runId)) throw new Error('Le numéro d’exécution de test doit contenir uniquement des chiffres.');
  const repository = process.env.GITHUB_REPOSITORY;
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Impossible de lire l’exécution GitHub : HTTP ${response.status}`);
  const { sha, attempt } = validateRun(await response.json(), repository);
  await appendFile(process.env.GITHUB_OUTPUT, `sha=${sha}\nattempt=${attempt}\nrun_id=${runId}\n`);
  console.log(`Promotion de la version testée : ${sha} (test ${runId}, tentative ${attempt}).`);
}
