import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function styleProfileSha256(profile) {
  return createHash('sha256').update(canonicalize(profile)).digest('hex');
}

function resolveRef(schema, rootSchema) {
  if (!schema?.$ref) return schema;
  const parts = schema.$ref.replace(/^#\//, '').split('/');
  return parts.reduce(
    (value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')],
    rootSchema,
  );
}

function validateNode(value, inputSchema, rootSchema, location, errors) {
  const schema = resolveRef(inputSchema, rootSchema);
  if (!schema) return errors.push(`${location}: unresolved schema reference.`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${location}: expected object.`);
      return;
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${location}.${key}: required value is missing.`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {})))
          errors.push(`${location}.${key}: unexpected value.`);
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value)
        validateNode(value[key], childSchema, rootSchema, `${location}.${key}`, errors);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${location}: expected array.`);
      return;
    }
    if (schema.minItems != null && value.length < schema.minItems)
      errors.push(`${location}: requires at least ${schema.minItems} items.`);
    if (schema.maxItems != null && value.length > schema.maxItems)
      errors.push(`${location}: allows at most ${schema.maxItems} items.`);
    if (schema.uniqueItems && new Set(value.map(canonicalize)).size !== value.length)
      errors.push(`${location}: items must be unique.`);
    value.forEach((item, index) =>
      validateNode(item, schema.items ?? {}, rootSchema, `${location}[${index}]`, errors),
    );
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') errors.push(`${location}: expected string.`);
    else {
      if (schema.minLength != null && value.length < schema.minLength)
        errors.push(`${location}: string is too short.`);
      if (schema.pattern && !new RegExp(schema.pattern).test(value))
        errors.push(`${location}: invalid format.`);
    }
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      errors.push(`${location}: expected finite number.`);
    else {
      if (schema.minimum != null && value < schema.minimum)
        errors.push(`${location}: below minimum ${schema.minimum}.`);
      if (schema.maximum != null && value > schema.maximum)
        errors.push(`${location}: above maximum ${schema.maximum}.`);
    }
  } else if (schema.type === 'boolean' && typeof value !== 'boolean')
    errors.push(`${location}: expected boolean.`);
  if (schema.enum && !schema.enum.includes(value))
    errors.push(`${location}: value is not allowed.`);
}

export function validateStyleProfile(profile, schema, lockedImages) {
  const errors = [];
  validateNode(profile, schema, schema, '$', errors);
  const canonicalLocks = [...lockedImages]
    .map((item) => (typeof item === 'string' ? item : item.id))
    .sort();
  const profileLocks = [...(profile?.lockedImages ?? [])].sort();
  if (canonicalize(canonicalLocks) !== canonicalize(profileLocks)) {
    errors.push('$.lockedImages: declarations do not exactly match photo-processing/config.json.');
  }
  if (errors.length)
    throw new Error(`Invalid Casa La Arbolada style profile:\n- ${errors.join('\n- ')}`);
  return profile;
}

export function validateJsonSchema(value, schema, label = 'Structured response') {
  const errors = [];
  validateNode(value, schema, schema, '$', errors);
  if (errors.length)
    throw new Error(`${label} failed schema validation:\n- ${errors.join('\n- ')}`);
  return value;
}

function environmentNumber(environment, key, fallback) {
  if (environment[key] == null || environment[key] === '') return fallback;
  const value = Number(environment[key]);
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error(`${key} must be from 0 through 100.`);
  return value;
}

function environmentBoolean(environment, key, fallback) {
  if (environment[key] == null || environment[key] === '') return fallback;
  if (environment[key] === 'true') return true;
  if (environment[key] === 'false') return false;
  throw new Error(`${key} must be true or false.`);
}

function environmentConfidence(environment, key, fallback) {
  if (environment[key] == null || environment[key] === '') return fallback;
  const value = Number(environment[key]);
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new Error(`${key} must be from 0 through 1.`);
  return value;
}

function environmentContradictionPolicy(environment, fallback) {
  const value = environment.PHOTO_POST_VALIDATION_CONTRADICTION_POLICY?.trim() || fallback;
  if (value !== 'manual-review') {
    throw new Error(
      'PHOTO_POST_VALIDATION_CONTRADICTION_POLICY currently supports only manual-review.',
    );
  }
  return value;
}

export async function loadStyleProfile({ root, config, environment = process.env }) {
  const relativePath = environment.PHOTO_STYLE_PROFILE?.trim() || config.style.profilePath;
  const profilePath = path.resolve(root, relativePath);
  const schemaPath = path.resolve(root, config.style.schemaPath);
  let profile;
  let schema;
  try {
    profile = JSON.parse(await fs.readFile(profilePath, 'utf8'));
  } catch (error) {
    throw new Error(`Style profile is missing or malformed at ${relativePath}: ${error.message}`);
  }
  try {
    schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Style profile schema is missing or malformed at ${config.style.schemaPath}: ${error.message}`,
    );
  }
  validateStyleProfile(profile, schema, config.lockedImages);
  return Object.freeze({
    profile,
    normalized: canonicalize(profile),
    profileId: profile.profileId,
    version: profile.version,
    sha256: styleProfileSha256(profile),
    relativePath: path.relative(root, profilePath).split(path.sep).join('/'),
    minimumNaturalness: environmentNumber(
      environment,
      'PHOTO_STYLE_MIN_NATURALNESS',
      config.style.minimumNaturalness,
    ),
    minimumProfileMatch: environmentNumber(
      environment,
      'PHOTO_STYLE_MIN_PROFILE_MATCH',
      config.style.minimumProfileMatch,
    ),
    postAnalysis: environmentBoolean(environment, 'PHOTO_POST_ANALYSIS', config.style.postAnalysis),
    postValidationPolicy: Object.freeze({
      minimumRejectConfidence: environmentConfidence(
        environment,
        'PHOTO_POST_VALIDATION_MIN_REJECT_CONFIDENCE',
        config.postValidationPolicy.minimumRejectConfidence,
      ),
      requireEvidence: environmentBoolean(
        environment,
        'PHOTO_POST_VALIDATION_REQUIRE_EVIDENCE',
        config.postValidationPolicy.requireEvidence,
      ),
      contradictionPolicy: environmentContradictionPolicy(
        environment,
        config.postValidationPolicy.contradictionPolicy,
      ),
    }),
  });
}
