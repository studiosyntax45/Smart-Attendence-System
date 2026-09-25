/** Staff type college (IST) dates; UTC midnight would file 00:00-05:30 IST under the previous day. */
export const COLLEGE_UTC_OFFSET = "+05:30";

export const dayStart = (ymd: string): Date => new Date(`${ymd}T00:00:00.000${COLLEGE_UTC_OFFSET}`);
export const dayEnd = (ymd: string): Date => new Date(`${ymd}T23:59:59.999${COLLEGE_UTC_OFFSET}`);
