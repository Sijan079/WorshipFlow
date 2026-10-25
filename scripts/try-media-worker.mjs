#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(root, '.tmp', 'media-worker-spike');

export function parseOptions(argv) {
  const options = { format: 'mp3', url: null, execute: false, rightsConfirmed: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--format' || arg === '--url') {
      if (!argv[i + 1]) throw new Error(`${arg} needs a value`);
      options[arg === '--format' ? 'format' : 'url'] = argv[++i];
    } else if (arg === '--execute') options.execute = true;
    else if (arg === '--rights-confirmed') options.rightsConfirmed = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!['mp3', 'mp4'].includes(options.format)) throw new Error('--format must be mp3 or mp4');
  if (options.url) {
    let parsed;
    try { parsed = new URL(options.url); } catch { throw new Error('Expected a valid HTTPS YouTube URL'); }
    const allowed = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
    if (parsed.protocol !== 'https:' || !allowed.includes(parsed.hostname) || parsed.username || parsed.password || parsed.port) {
      throw new Error('Expected a valid HTTPS YouTube URL');
    }
    if (!options.execute || !options.rightsConfirmed) {
      throw new Error('Real URL use requires --execute and --rights-confirmed');
    }
  } else if (options.execute || options.rightsConfirmed) {
    throw new Error('--execute and --rights-confirmed require --url');
  }
  return options;
}

export function ytDlpArgs({ format, url, outputTemplate }) {
  const args = [
    '--ignore-config', '--no-playlist', '--socket-timeout', '15',
    '--retries', '1', '--fragment-retries', '1', '--max-filesize', '100M',
    '--no-overwrites', '--output', outputTemplate,
  ];
  if (format === 'mp3') args.push('--extract-audio', '--audio-format', 'mp3');
  else args.push('--format', 'best[ext=mp4]/best', '--remux-video', 'mp4');
  return [...args, url];
}

function run(command, args, timeoutMs = 120_000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => { output = (output + chunk.toString()).slice(-12_000); });
    }
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && !timedOut) resolveRun(output);
      else reject(new Error(`${command} ${timedOut ? 'timed out' : `exited ${code}`}: ${output.slice(-2000)}`));
    });
  });
}

async function localFixture(file) {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=10',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '2', '-c:v', 'mpeg4', '-c:a', 'aac', '-movflags', '+faststart', file,
  ], 30_000);
  const server = createServer(async (request, response) => {
    if (request.url !== '/sample.mp4') { response.writeHead(404).end(); return; }
    const size = (await stat(file)).size;
    response.writeHead(200, { 'content-type': 'video/mp4', 'content-length': size });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/sample.mp4` };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const id = randomUUID();
  const dir = join(outputRoot, id);
  await mkdir(dir, { recursive: true });
  const job = { id, mode: options.url ? 'youtube' : 'local-fixture', format: options.format, status: 'queued', output: null, error: null };
  const manifest = join(dir, 'job.json');
  const save = async () => {
    await writeFile(manifest, `${JSON.stringify(job, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ id, status: job.status, output: job.output, error: job.error })}\n`);
  };
  await save();
  let fixture;
  try {
    job.status = 'processing';
    await save();
    if (!options.url) fixture = await localFixture(join(dir, 'sample.mp4'));
    const url = options.url ?? fixture.url;
    await run('yt-dlp', ytDlpArgs({ format: options.format, url, outputTemplate: join(dir, 'output.%(ext)s') }));
    const files = await readdir(dir);
    const output = files.find(name => name === `output.${options.format}`);
    if (!output) throw new Error(`yt-dlp finished without output.${options.format}`);
    job.output = join(dir, output);
    job.status = 'done';
    await save();
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    await save();
    process.exitCode = 1;
  } finally {
    if (fixture) await new Promise(resolveClose => fixture.server.close(resolveClose));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
