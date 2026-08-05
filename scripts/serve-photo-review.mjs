import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  generateProcessingBatch,
  loadReviewState,
  updateReviewState,
} from './photo-review-state-lib.mjs';
import { updatePilotReviewState } from '../photo-processing/pilot.mjs';
import { root } from './photo-workflow-lib.mjs';

const host = '127.0.0.1';
const defaultPort = 4317;
const pilotStatePath = path.join(root, 'reports', 'photo-pilot-review-state.json');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 2 * 1024 * 1024) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function serveFile(response, pathname) {
  const requestedPath = pathname === '/' ? '/reports/photo-match-review.html' : pathname;
  const filePath = path.resolve(root, `.${decodeURIComponent(requestedPath)}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    sendJson(response, 403, { error: 'Forbidden path.' });
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type':
        contentTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(data);
  } catch (error) {
    sendJson(response, error?.code === 'ENOENT' ? 404 : 500, { error: error.message });
  }
}

export function createPhotoReviewServer() {
  return http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      response.end();
      return;
    }
    const url = new URL(request.url, `http://${host}`);
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { ok: true });
        return;
      }
      if (url.pathname === '/api/photo-review-state' && request.method === 'GET') {
        const { state } = await loadReviewState({ createIfMissing: true });
        sendJson(response, 200, state);
        return;
      }
      if (url.pathname === '/api/photo-review-state' && request.method === 'PUT') {
        const body = await readBody(request);
        sendJson(response, 200, await updateReviewState(body.decisions));
        return;
      }
      if (url.pathname === '/api/photo-processing-batch' && request.method === 'POST') {
        const result = await generateProcessingBatch();
        sendJson(response, 200, result);
        return;
      }
      if (url.pathname === '/api/photo-pilot-review-state' && request.method === 'GET') {
        sendJson(response, 200, JSON.parse(await fs.readFile(pilotStatePath, 'utf8')));
        return;
      }
      if (url.pathname === '/api/photo-pilot-review-state' && request.method === 'PUT') {
        const body = await readBody(request);
        sendJson(
          response,
          200,
          await updatePilotReviewState({ statePath: pilotStatePath, decisions: body.decisions }),
        );
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'Unknown review API endpoint.' });
        return;
      }
      await serveFile(response, url.pathname);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PHOTO_REVIEW_PORT ?? '', 10) || defaultPort;
  const server = createPhotoReviewServer();
  server.listen(port, host, () => {
    console.log(`Photo approval dashboard: http://${host}:${port}/reports/photo-match-review.html`);
    console.log('Decisions persist to reports/photo-review-state.json. Press Ctrl+C to stop.');
  });
}
