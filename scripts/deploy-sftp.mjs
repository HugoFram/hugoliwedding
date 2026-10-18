import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRelease } from './release.mjs';

// Public connection settings and the pinned public host key; never a password.
const defaults = JSON.parse(await readFile(new URL('../.github/strato.json', import.meta.url), 'utf8'));
const defaultKnownHosts = await readFile(new URL('../.github/strato_known_hosts', import.meta.url), 'utf8');

export const targets = Object.freeze({
  test: { directory: '/hugoli-mariage-test', url: 'https://hugoli-mariage-test.frammery.com/' },
  production: { directory: '/hugoli-mariage', url: 'https://hugoli-mariage.frammery.com/' },
});

export function getConfig(environment, env = process.env) {
  if (!Object.hasOwn(targets, environment)) throw new Error('Destination autorisée : test ou production.');
  const settings = {
    ...env,
    STRATO_SFTP_HOST: env.STRATO_SFTP_HOST || defaults.host,
    STRATO_SFTP_USER: env.STRATO_SFTP_USER || defaults.user,
    STRATO_SSH_KNOWN_HOSTS: env.STRATO_SSH_KNOWN_HOSTS || defaultKnownHosts,
  };
  for (const key of ['STRATO_SFTP_HOST', 'STRATO_SFTP_USER', 'STRATO_SFTP_PASSWORD', 'STRATO_SSH_KNOWN_HOSTS']) {
    if (!settings[key]?.trim()) throw new Error(`Configuration GitHub manquante : ${key}`);
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(settings.STRATO_SFTP_HOST)
    || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(settings.STRATO_SFTP_USER)) {
    throw new Error('Nom de serveur ou utilisateur SFTP invalide.');
  }
  const port = env.STRATO_SFTP_PORT || defaults.port;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Port SFTP invalide.');
  return { ...targets[environment], host: settings.STRATO_SFTP_HOST, user: settings.STRATO_SFTP_USER, knownHosts: settings.STRATO_SSH_KNOWN_HOSTS, port };
}

function quote(value) {
  // Only repository filenames and OS-generated temporary paths reach SFTP.
  if (/[\r\n\0"\\*?\[\]]/.test(value)) throw new Error('Chemin SFTP non pris en charge.');
  return `"${value}"`;
}

export function createBatch(config, releaseDirectory, manifest) {
  if (!Object.values(targets).some(target => target.directory === config.directory)) throw new Error('Dossier SFTP interdit.');
  const root = path.resolve(releaseDirectory, 'site').split(path.sep).join('/');
  const filenames = Object.keys(manifest.files).filter(name => !['index.html', '.htaccess'].includes(name)).sort();
  const directories = new Set();
  for (const filename of filenames) {
    if (!filename.startsWith(`releases/${manifest.releaseId}/`)) throw new Error('Chemin de version invalide.');
    const parts = filename.split('/');
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
  }
  const lines = [`cd ${quote(config.directory)}`];
  // A directory may already exist on retry. All puts and renames must succeed.
  for (const directory of [...directories].sort()) lines.push(`-mkdir ${quote(directory)}`);
  for (const filename of filenames) lines.push(`put ${quote(`${root}/${filename}`)} ${quote(filename)}`);
  for (const filename of ['.htaccess', 'index.html']) {
    const temporary = `.hugoli-${manifest.releaseId}-${filename}`;
    lines.push(`put ${quote(`${root}/${filename}`)} ${quote(temporary)}`);
    lines.push(`rename ${quote(temporary)} ${quote(filename)}`);
  }
  // There are deliberately no deletion commands or writes to the storage root.
  return lines.join('\n') + '\nbye\n';
}

async function deploy(environment, releaseDirectory) {
  const config = getConfig(environment);
  if (process.argv.includes('--check-config')) return console.log('Configuration SFTP présente.');
  const manifest = await verifyRelease(releaseDirectory, {
    sha: process.env.EXPECTED_SHA, runId: process.env.EXPECTED_RUN_ID, attempt: process.env.EXPECTED_ATTEMPT,
  });
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'hugoli-sftp-'));
  const knownHosts = path.join(temporary, 'known_hosts');
  const batch = path.join(temporary, 'batch');
  try {
    await writeFile(knownHosts, config.knownHosts.trim() + '\n', { mode: 0o600 });
    await writeFile(batch, createBatch(config, releaseDirectory, manifest), { mode: 0o600 });
    await new Promise((resolve, reject) => {
      const child = spawn('sshpass', ['-e', 'sftp',
        '-oBatchMode=no', '-oStrictHostKeyChecking=yes', `-oUserKnownHostsFile=${knownHosts}`,
        '-oPreferredAuthentications=password,keyboard-interactive', '-oPubkeyAuthentication=no',
        '-oConnectTimeout=20', '-oServerAliveInterval=15', '-oServerAliveCountMax=2',
        '-P', config.port, '-b', batch, `${config.user}@${config.host}`,
      ], { stdio: 'inherit', env: { ...process.env, SSHPASS: process.env.STRATO_SFTP_PASSWORD } });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Échec du transfert SFTP (code ${code}).`)));
    });
    console.log(`Version ${manifest.releaseId} transférée vers ${config.url}`);
  } finally {
    await Promise.allSettled([unlink(knownHosts), unlink(batch)]);
    await rmdir(temporary);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await deploy(process.argv[2], process.argv[3] ?? 'artifacts/release');
}
