export function parseTimeString(str, dateFormat = "mm/dd/yyyy", timeFormat = "24h") {
  // Example: when dateFormat = "day-num", input might be "Day 2, 14:30"
  const mDay = str.match(/day\s*(\d+),\s*(\d+):(\d+)/i);
  if (mDay) {
    const dayNum = parseInt(mDay[1], 10);
    const h = parseInt(mDay[2], 10);
    const min = parseInt(mDay[3], 10);
    return dayNum * 24 * 60 + h * 60 + min;
  }
  // Additional parsing logic could go here: mm/dd/yyyy etc
  return null;
}
