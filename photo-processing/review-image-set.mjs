export function isTechnicalReviewCandidate(result) {
  return Boolean(
    result &&
      result.status !== 'ERROR' &&
      result.geometryValidation?.status === 'passed' &&
      result.normalization?.status === 'normalized' &&
      result.quality?.semanticValidation?.status !== 'Rejected' &&
      result.postDecision?.outcome !== 'REJECT' &&
      result.developedPreviewPath,
  );
}
