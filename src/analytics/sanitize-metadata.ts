const FORBIDDEN_METADATA_KEY =
  /(password|token|secret|credential|authorization|card|cvv|pin)/i;

export function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEY.test(key)) continue;
    if (typeof value === 'string' && value.length > 500) {
      out[key] = value.slice(0, 500);
      continue;
    }
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 20).map((v) =>
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
          ? v
          : String(v),
      );
    }
  }
  return out;
}
