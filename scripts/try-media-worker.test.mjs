import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOptions, ytDlpArgs } from './try-media-worker.mjs';

test('defaults to an offline MP3 fixture job', () => {
  assert.deepEqual(parseOptions([]), { format: 'mp3', url: null, execute: false, rightsConfirmed: false });
});

test('requires deliberate authorization for a real YouTube URL', () => {
  assert.throws(() => parseOptions(['--url', 'https://www.youtube.com/watch?v=abcdefghijk']), /--execute.*--rights-confirmed/);
  assert.throws(() => parseOptions(['--url', 'https://example.com/video', '--execute', '--rights-confirmed']), /YouTube URL/);
  assert.throws(() => parseOptions(['--url', 'http://www.youtube.com/watch?v=abcdefghijk', '--execute', '--rights-confirmed']), /YouTube URL/);
  assert.equal(parseOptions(['--url', 'https://youtu.be/abcdefghijk', '--execute', '--rights-confirmed']).url, 'https://youtu.be/abcdefghijk');
});

test('accepts only the supported output formats', () => {
  assert.equal(parseOptions(['--format', 'mp4']).format, 'mp4');
  assert.throws(() => parseOptions(['--format', 'wav']), /mp3 or mp4/);
  assert.throws(() => parseOptions(['--bogus']), /Unknown option/);
});

test('yt-dlp receives an argument array with one output path and one URL', () => {
  const args = ytDlpArgs({ format: 'mp3', url: 'http://127.0.0.1:1234/sample.mp4', outputTemplate: 'C:/tmp/output.%(ext)s' });
  assert.ok(args.includes('--no-playlist'));
  assert.ok(args.includes('--audio-format'));
  assert.equal(args.at(-1), 'http://127.0.0.1:1234/sample.mp4');
});
