export type Holiday = "halloween" | "christmas" | "valentines" | null;

/**
 * Returns the active holiday based on the current date.
 * Windows are intentionally a little wide so the effect feels present.
 */
export function getActiveHoliday(date: Date = new Date()): Holiday {
  const month = date.getMonth() + 1; // 1–12
  const day = date.getDate();

  // Halloween: Oct 25 – Nov 2
  if ((month === 10 && day >= 25) || (month === 11 && day <= 2)) {
    return "halloween";
  }

  // Christmas: Dec 15 – Jan 2
  if ((month === 12 && day >= 15) || (month === 1 && day <= 2)) {
    return "christmas";
  }

  // Valentine's: Feb 10 – Feb 16
  if (month === 2 && day >= 10 && day <= 16) {
    return "valentines";
  }

  return null;
}
