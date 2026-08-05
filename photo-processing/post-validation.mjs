const defaultPolicy = Object.freeze({
  minimumRejectConfidence: 0.85,
  requireEvidence: true,
  contradictionPolicy: 'manual-review',
});

const positiveNaturalnessPattern =
  /\b(natural|naturally|realistic|preserv(?:e|ed)|minimal|clean|without (?:visual )?artifacts|not overprocessed)\b/i;
const positiveProfilePattern =
  /\b(align(?:s|ed)?|style|profile|editorial|color(?:s)? (?:align|remain|are)|well-balanced)\b/i;
const rejectionRecommendationPattern =
  /\b(reject(?:ed|ion)?|recommend(?:s|ed)? (?:manual )?rejection|should not pass)\b/i;

function policyFor(style) {
  return { ...defaultPolicy, ...(style?.postValidationPolicy ?? {}) };
}

function localStructuralFailures(localQuality) {
  const failures = [...(localQuality?.semanticValidation?.violations ?? [])];
  if (localQuality?.semanticValidation?.status !== 'Passed')
    failures.push('Local semantic/structural validation did not pass.');
  const source = localQuality?.sourceDimensions;
  const output = localQuality?.outputDimensions;
  if (!source || !output || source.width !== output.width || source.height !== output.height)
    failures.push('Output dimensions do not exactly match the source.');
  if (localQuality?.aspectRatioDelta !== 0) failures.push('Aspect-ratio mapping is not identity.');
  if (localQuality?.semanticValidation?.geometryOperationsApplied !== false)
    failures.push('Geometry operator attestation failed.');
  if (localQuality?.semanticValidation?.pixelCoordinateMapping !== 'identity')
    failures.push('Pixel coordinate mapping is not identity.');
  return [...new Set(failures)];
}

function normalizeDefects(violations, policy) {
  return (violations ?? []).map((violation) => {
    if (typeof violation === 'string') {
      return {
        ruleId: violation,
        description: violation,
        evidence: null,
        confidence: null,
        legacy: true,
        supported: false,
        definitive: false,
      };
    }
    const ruleId = String(violation?.ruleId ?? '').trim();
    const description = String(violation?.description ?? '').trim();
    const evidence = String(violation?.evidence ?? '').trim();
    const confidence = Number.isFinite(violation?.confidence) ? violation.confidence : null;
    const hasEvidence = Boolean(evidence);
    const supported = Boolean(
      ruleId && description && confidence != null && (!policy.requireEvidence || hasEvidence),
    );
    return {
      ruleId,
      description,
      evidence: evidence || null,
      confidence,
      legacy: false,
      supported,
      definitive: Boolean(supported && confidence >= policy.minimumRejectConfidence && hasEvidence),
    };
  });
}

function contradictionFlags({ value, scoreFailures, defects, policy }) {
  const notes = (value.reviewNotes ?? []).join(' ');
  const flags = [];
  if (scoreFailures.naturalness && positiveNaturalnessPattern.test(notes))
    flags.push('naturalness-score-conflicts-with-positive-review-notes');
  if (scoreFailures.profileMatch && positiveProfilePattern.test(notes))
    flags.push('profile-score-conflicts-with-positive-review-notes');
  if ((scoreFailures.naturalness || scoreFailures.profileMatch) && notes.trim())
    flags.push('positive-or-neutral-notes-with-failing-scores');
  if (!defects.length && rejectionRecommendationPattern.test(notes))
    flags.push('rejection-recommendation-without-supported-violation');
  if (
    (scoreFailures.naturalness || scoreFailures.profileMatch) &&
    defects.every((defect) => !defect.definitive)
  )
    flags.push('score-failure-without-supported-high-confidence-defect');
  if (defects.some((defect) => defect.legacy)) flags.push('unsupported-legacy-violation-label');
  if (defects.some((defect) => defect.supported && !defect.definitive))
    flags.push('concrete-defect-below-definitive-confidence');
  if (
    (scoreFailures.naturalness || scoreFailures.profileMatch) &&
    value.confidence < policy.minimumRejectConfidence
  )
    flags.push('low-confidence-score-failure');
  return [...new Set(flags)];
}

export function evaluatePostValidation({ response, localQuality, style }) {
  const value = response?.styleValidation;
  const policy = policyFor(style);
  if (!value) {
    return {
      outcome: 'REJECT',
      accepted: false,
      status: 'Rejected',
      reasons: ['Post-development style validation is missing.'],
      concreteDefects: [],
      legacyViolations: [],
      contradictionFlags: [],
      gates: {
        localStructuralGate: { failed: false, reasons: [] },
        semanticGate: { failed: false },
        geometryGate: { failed: false },
        overprocessingGate: { failed: false },
        concreteVisualDefect: { failed: false, defects: [] },
        forbiddenViolation: { failed: false, defects: [] },
        scoreThreshold: { failed: true, reasons: ['Post-validation scores are missing.'] },
        contradictionManualReview: { routed: false, flags: [] },
      },
      policy,
    };
  }

  const structuralFailures = localStructuralFailures(localQuality);
  const defects = normalizeDefects(value.violations, policy);
  const definitiveDefects = defects.filter((defect) => defect.definitive);
  const legacyViolations = defects.filter((defect) => defect.legacy);
  const scoreFailures = {
    naturalness: value.naturalnessScore < style.minimumNaturalness,
    profileMatch: value.profileMatchScore < style.minimumProfileMatch,
  };
  const contradictions = contradictionFlags({ value, scoreFailures, defects, policy });
  const hardReasons = [];
  if (structuralFailures.length)
    hardReasons.push(`Local structural validation failed: ${structuralFailures.join('; ')}`);
  if (value.semanticChangeSuspected) hardReasons.push('Semantic change suspected.');
  if (value.geometryChangeSuspected) hardReasons.push('Geometry change suspected.');
  if (value.overprocessed) hardReasons.push('Candidate appears overprocessed.');
  if (definitiveDefects.length) {
    hardReasons.push(
      `Supported high-confidence defect: ${definitiveDefects
        .map(
          (defect) =>
            `${defect.ruleId} (${defect.confidence.toFixed(2)}): ${defect.description} — ${defect.evidence}`,
        )
        .join('; ')}`,
    );
  }

  let outcome;
  const reasons = [];
  if (hardReasons.length) {
    outcome = 'REJECT';
    reasons.push(...hardReasons);
  } else if (!scoreFailures.naturalness && !scoreFailures.profileMatch && defects.length === 0) {
    outcome = 'PASS';
    reasons.push('All structural, semantic, geometry, style-score, and defect gates passed.');
  } else {
    outcome = 'MANUAL_REVIEW';
    if (scoreFailures.naturalness)
      reasons.push(
        `Naturalness score ${value.naturalnessScore} is below ${style.minimumNaturalness}, without a definitive defect.`,
      );
    if (scoreFailures.profileMatch)
      reasons.push(
        `Profile-match score ${value.profileMatchScore} is below ${style.minimumProfileMatch}, without a definitive defect.`,
      );
    if (legacyViolations.length)
      reasons.push('Legacy free-text violation labels lack structured visual evidence.');
    if (defects.some((defect) => defect.supported && !defect.definitive))
      reasons.push('A concrete defect was reported below definitive-rejection confidence.');
    if (contradictions.length)
      reasons.push(`Contradiction policy routed to manual review: ${contradictions.join(', ')}.`);
  }

  return {
    outcome,
    accepted: outcome === 'PASS',
    status:
      outcome === 'PASS'
        ? 'Passed Policy'
        : outcome === 'REJECT'
          ? 'Rejected'
          : 'Manual Review Required',
    reasons,
    rawScores: {
      profileMatchScore: value.profileMatchScore,
      naturalnessScore: value.naturalnessScore,
      colorConsistencyScore: value.colorConsistencyScore,
      confidence: value.confidence,
    },
    concreteDefects: defects.filter((defect) => !defect.legacy),
    legacyViolations,
    contradictionFlags: contradictions,
    gates: {
      localStructuralGate: { failed: structuralFailures.length > 0, reasons: structuralFailures },
      semanticGate: { failed: value.semanticChangeSuspected },
      geometryGate: { failed: value.geometryChangeSuspected },
      overprocessingGate: { failed: value.overprocessed },
      concreteVisualDefect: {
        failed: definitiveDefects.length > 0,
        defects: definitiveDefects,
      },
      forbiddenViolation: {
        failed: definitiveDefects.length > 0,
        defects: definitiveDefects,
      },
      scoreThreshold: {
        failed: scoreFailures.naturalness || scoreFailures.profileMatch,
        naturalnessFailed: scoreFailures.naturalness,
        profileMatchFailed: scoreFailures.profileMatch,
      },
      contradictionManualReview: {
        routed: outcome === 'MANUAL_REVIEW' && contradictions.length > 0,
        flags: contradictions,
      },
    },
    policy,
  };
}

export function reclassifyPilotResults({ results, style }) {
  return results.map((result) => {
    const policyDecision = evaluatePostValidation({
      response: result.postAnalysis,
      localQuality: result.quality,
      style,
    });
    return {
      ...result,
      postDecision: policyDecision,
      policyOutcome: policyDecision.outcome,
      reviewStatus:
        policyDecision.outcome === 'PASS'
          ? 'Human Review Required'
          : policyDecision.outcome === 'REJECT'
            ? 'Rejected'
            : 'Manual Review Required',
      status:
        policyDecision.outcome === 'REJECT'
          ? 'REJECTED'
          : policyDecision.outcome === 'MANUAL_REVIEW'
            ? 'MANUAL_REVIEW'
            : result.status === 'REJECTED' || result.status === 'MANUAL_REVIEW'
              ? 'CACHED'
              : result.status,
      publicationStatus: 'Human Review Required',
    };
  });
}
