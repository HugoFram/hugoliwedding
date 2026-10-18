import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRelease, verifyRelease } from '../scripts/release.mjs';
import { getConfig, createBatch } from '../scripts/deploy-sftp.mjs';
import { validateRun } from '../scripts/validate-promotion.mjs';

const identity = { sha: 'a'.repeat(40), runId: '12345', attempt: '1' };
const config = {
  STRATO_SFTP_HOST: 'sftp.example.com', STRATO_SFTP_USER: 'test-user',
  STRATO_SFTP_PASSWORD: 'fake-test-password', STRATO_SSH_KNOWN_HOSTS: 'example-host-key',
};

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hugoli-release-test-'));
  t.after(async () => {
    // Verify the absolute temporary directory before recursive cleanup on Windows.
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('hugoli-release-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  const manifest = await createRelease(fileURLToPath(new URL('../public/', import.meta.url)), directory, identity);
  return { directory, manifest };
}

test('la version contient des ressources isolées, une identité et les bons liens', async t => {
  const { directory, manifest } = await fixture(t);
  const html = await readFile(path.join(directory, 'site/index.html'), 'utf8');
  assert.ok(html.includes(`src="./releases/${manifest.releaseId}/assets/chateau.svg"`));
  assert.ok(html.includes(`href="./releases/${manifest.releaseId}/hugoli-10-juin-2028.ics"`));
  assert.ok(html.includes(`name="hugoli-release" content="${manifest.releaseId}"`));
  assert.ok(html.includes('href="#lieu"'));
  assert.ok(manifest.files['.htaccess']);
  assert.deepEqual(await verifyRelease(directory, identity), manifest);
});

test('un fichier altéré ou une autre identité empêche la promotion', async t => {
  const { directory } = await fixture(t);
  await assert.rejects(verifyRelease(directory, { sha: 'b'.repeat(40) }), /correspond pas/);
  await writeFile(path.join(directory, 'site/index.html'), 'modified');
  await assert.rejects(verifyRelease(directory), /Empreinte incorrecte/);
});

test('un fichier ajouté à l’archive est refusé', async t => {
  const { directory } = await fixture(t);
  await writeFile(path.join(directory, 'site/unexpected.txt'), 'unexpected');
  await assert.rejects(verifyRelease(directory), /Liste de fichiers incohérente/);
});

test('le transfert ne vise que les deux dossiers, sans suppression, avec index en dernier', async t => {
  const { directory, manifest } = await fixture(t);
  for (const [environment, target] of [['test', '/hugoli-mariage-test'], ['production', '/hugoli-mariage']]) {
    const batch = createBatch(getConfig(environment, config), directory, manifest);
    assert.ok(batch.startsWith(`cd "${target}"\n`));
    assert.ok(!/^(?:rm|rmdir|!)/m.test(batch));
    assert.ok(batch.trim().endsWith(`rename ".hugoli-${manifest.releaseId}-index.html" "index.html"\nbye`));
    assert.ok(batch.indexOf('/assets/app.mjs') < batch.lastIndexOf('"index.html"'));
  }
  assert.throws(() => createBatch({ directory: '/' }, directory, manifest), /interdit/);
});

test('les destinations inconnues et configurations SFTP malformées sont refusées', () => {
  assert.throws(() => getConfig('prod', config), /Destination autorisée/);
  assert.throws(() => getConfig('__proto__', config), /Destination autorisée/);
  assert.throws(() => getConfig('test', {}), /Configuration GitHub manquante/);
  assert.throws(() => getConfig('test', { ...config, STRATO_SFTP_HOST: '-oProxyCommand=bad' }), /invalide/);
  assert.throws(() => getConfig('test', { ...config, STRATO_SFTP_PORT: '0' }), /Port SFTP/);
});

const successfulRun = {
  repository: { full_name: 'HugoFram/hugoliwedding' }, head_repository: { full_name: 'HugoFram/hugoliwedding' },
  path: '.github/workflows/deploy-test.yml', head_branch: 'main', event: 'push',
  status: 'completed', conclusion: 'success', head_sha: identity.sha, run_attempt: 1,
};

test('seul un déploiement de test réussi du dépôt peut être promu', () => {
  assert.deepEqual(validateRun(successfulRun, 'HugoFram/hugoliwedding'), { sha: identity.sha, attempt: '1' });
  for (const overrides of [
    { conclusion: 'failure' }, { status: 'in_progress' }, { head_branch: 'feature' },
    { event: 'pull_request' }, { path: '.github/workflows/ci.yml' },
    { head_repository: { full_name: 'someone/fork' } }, { run_attempt: 0 },
  ]) assert.throws(() => validateRun({ ...successfulRun, ...overrides }, 'HugoFram/hugoliwedding'));
});
