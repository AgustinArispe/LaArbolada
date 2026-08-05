const configurableProviders = new Set(['gemini', 'openai', 'custom']);

export function resolveProviderName(config, environment = process.env) {
  const name = (environment.PHOTO_PROVIDER || config.provider?.default || 'gemini')
    .trim()
    .toLowerCase();
  if (!configurableProviders.has(name)) {
    throw new Error(
      `Unsupported PHOTO_PROVIDER=${name}. Allowed values: ${[...configurableProviders].join(', ')}.`,
    );
  }
  return name;
}

function assertProvider(provider, name) {
  if (
    !provider ||
    provider.name !== name ||
    !provider.cacheModelIdentity ||
    !Number.isFinite(provider.maximumOutputBytes) ||
    typeof provider.analyze !== 'function' ||
    typeof provider.edit !== 'function' ||
    typeof provider.validateDevelopment !== 'function'
  ) {
    throw new Error(
      `Photo provider ${name} does not implement analyze(request), edit(request), and validateDevelopment(request).`,
    );
  }
  return provider;
}

/**
 * Load a provider without exposing provider-specific behavior to the processing pipeline.
 * A future provider only needs a module named after its PHOTO_PROVIDER value that exports
 * createProvider(context) and returns { name, model, analyze(request), edit(request),
 * validateDevelopment(request) }.
 */
export async function createPhotoProvider({
  config,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const name = resolveProviderName(config, environment);
  let module;
  try {
    module = await import(new URL(`./${name}.mjs`, import.meta.url));
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error(
      `PHOTO_PROVIDER=${name} is reserved but no adapter is installed. Add photo-processing/providers/${name}.mjs using the provider interface.`,
    );
  }
  return assertProvider(await module.createProvider({ config, environment, fetchImpl }), name);
}

export const providerContract = Object.freeze({
  configurableProviders: [...configurableProviders],
  requiredMethods: [
    'analyze({ imageBuffer, mimeType, prompt, styleProfile, metadata })',
    'edit({ imageBuffer, mimeType, prompt, metadata })',
    'validateDevelopment({ originalBuffer, developedBuffer, prompt, metadata })',
  ],
  requiredProperties: ['cacheModelIdentity', 'maximumOutputBytes'],
});
