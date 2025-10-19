export function parseTimeString(str) {
  // naive parser: "Day X, HH:MM" format
  const m = str.match(/day\s*(\d+),\s*(\d+):(\d+)/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    const min = parseInt(m[3], 10);
    return day * 24 * 60 + h * 60 + min;
  }
  // maybe other formats here
  return null;
}
