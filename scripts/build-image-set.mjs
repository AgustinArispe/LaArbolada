import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedSet = process.argv[2];
const outputDirectories = {
  original: 'dist-original',
  'gemini-review': 'dist-gemini',
};
const outputDirectory = outputDirectories[requestedSet];

if (!outputDirectory) {
  throw new Error('Image-set build requires "original" or "gemini-review".');
}

const child = spawn(
  process.execPath,
  [path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'],
  {
    cwd: root,
    env: {
      ...process.env,
      PUBLIC_IMAGE_SET: requestedSet,
      BUILD_OUTPUT_DIR: outputDirectory,
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
