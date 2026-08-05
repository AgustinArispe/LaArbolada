export function isGeminiReviewBuild(imageSet) {
  return imageSet === 'gemini-review';
}

export function selectGeminiReviewImages(images, manifest, lockedImageIds) {
  const entries = new Map(
    (manifest?.images ?? []).map((entry) => [entry.photoId, entry]),
  );
  return images.map((image) => {
    const entry = entries.get(image.id);
    if (
      lockedImageIds.has(image.id) ||
      entry?.servedSet !== 'gemini-review' ||
      entry?.fallback ||
      !entry?.sources
    ) {
      return image;
    }
    return { ...image, sources: entry.sources };
  });
}
