import path from 'node:path';
import { runPhotoPipeline, validatePhotoPipeline } from '../photo-processing/pipeline.mjs';
import { loadWorkflow, root } from './photo-workflow-lib.mjs';

try {
  process.loadEnvFile?.(path.join(root, '.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const command = process.argv[2] ?? 'validate';
const argumentsSet = new Set(process.argv.slice(3));
const workflow = await loadWorkflow();

if (command === 'validate') {
  const status = await validatePhotoPipeline({ workflow });
  console.log(`Provider: ${status.providerName}`);
  console.log(`Provider mode: ${status.providerMode} (approved source-to-edited-raster workflow)`);
  console.log(`Gemini image-editing model: ${status.model}`);
  console.log(`Gemini analysis model: ${status.analysisModel}`);
  console.log(
    `Gemini image output: ${status.imageOutput.aspectRatio} at ${status.imageOutput.imageSize} (${status.imageOutput.configurationVersion})`,
  );
  console.log(`Concurrency: ${status.concurrency}`);
  console.log(`Approved: ${status.counts.approved}`);
  console.log(`Skipped: ${status.counts.skipped}`);
  console.log(`Needs manual editing: ${status.counts.manual}`);
  console.log(`Pending: ${status.counts.pending}`);
  console.log(`Locked: ${status.locked} (published SHA-256 checks passed)`);
  console.log(
    `Style: ${status.styleProfile.profileId}@${status.styleProfile.version} (${status.styleProfile.sha256})`,
  );
  console.log(`Post-development analysis: ${status.postAnalysis ? 'enabled' : 'disabled'}`);
  console.log(`Photographic development profiles: ${status.developmentProfiles} validated`);
  console.log('API key: not required for validation; no upload, editing, or processing occurred.');
  console.log(
    'Reports: reports/gemini-processing-report.md, reports/gemini-metrics.json, reports/gemini-comparisons.html',
  );
} else if (command === 'single' || command === 'pilot' || command === 'full') {
  if (!argumentsSet.has('--confirm-upload')) {
    throw new Error(
      `Provider upload is locked. Re-run photos:gemini-${command} with -- --confirm-upload only after reviewing reports/photo-processing-batch.json.`,
    );
  }
  const targetArgument = [...argumentsSet].find((argument) => argument.startsWith('--target='));
  const targetId = targetArgument?.slice('--target='.length) || null;
  if (command === 'single' && !targetId) {
    throw new Error('Single-image mode requires --target=<approved-catalog-id>.');
  }
  const results = await runPhotoPipeline({ workflow, mode: command, targetId });
  console.log(
    `${results.length} approved ${command} image(s) completed; human review remains required.`,
  );
  if (results.providerRequests) {
    console.log(
      `Gemini requests: ${results.providerRequests.total} logical (${results.providerRequests.analysis} analysis, ${results.providerRequests.editing} image editing, ${results.providerRequests.postValidation} post-validation; ${results.providerRequests.httpAttempts} HTTP attempt(s)).`,
    );
  }
} else {
  throw new Error(`Unknown Gemini photo workflow command: ${command}.`);
}
