export function formatValue(value) {
  const safe = Number.isFinite(value) ? value : 0;
  const unsigned = safe >>> 0;
  return `0x${unsigned.toString(16).padStart(8, '0')}`;
}
