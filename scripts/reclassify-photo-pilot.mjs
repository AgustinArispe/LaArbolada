import path from 'node:path';
import { reclassifyExistingPilot } from '../photo-processing/offline-reclassification.mjs';
import { loadWorkflow, root } from './photo-workflow-lib.mjs';

try {
  process.loadEnvFile?.(path.join(root, '.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const workflow = await loadWorkflow();
const result = await reclassifyExistingPilot({ workflow });

console.log('Offline pilot policy reclassification completed.');
for (const id of workflow.config.pilotIds) console.log(`${id}: ${result.outcomes[id]}`);
console.log(`Gemini requests: ${result.providerRequests}`);
console.log(`Images reprocessed: ${result.reprocessedImages}`);
console.log(`Cache unchanged: ${result.cacheSha256}`);
console.log(`Pilot review state: ${result.pilotStatePath}`);
