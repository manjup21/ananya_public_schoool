export const ACHIEVEMENT_GUIDE = Object.freeze([
  Object.freeze({ min: 91, max: 100, grade: 'A1', gradePoint: 10, stars: 5 }),
  Object.freeze({ min: 81, max: 90, grade: 'A2', gradePoint: 9, stars: 0 }),
  Object.freeze({ min: 71, max: 80, grade: 'B1', gradePoint: 8, stars: 4 }),
  Object.freeze({ min: 61, max: 70, grade: 'B2', gradePoint: 7, stars: 0 }),
  Object.freeze({ min: 51, max: 60, grade: 'C1', gradePoint: 6, stars: 3 }),
  Object.freeze({ min: 41, max: 50, grade: 'C2', gradePoint: 5, stars: 0 }),
  Object.freeze({ min: 33, max: 40, grade: 'D1', gradePoint: 4, stars: 2 }),
  Object.freeze({ min: 21, max: 32, grade: 'D2', gradePoint: 3, stars: 0 }),
  Object.freeze({ min: 0, max: 20, grade: 'E', gradePoint: 2, stars: 1 }),
]);

function percentFromMarks(obtained, max) {
  const obtainedNumber = Number(obtained);
  const maxNumber = Number(max);
  if (!Number.isFinite(obtainedNumber) || !Number.isFinite(maxNumber) || maxNumber <= 0) {
    return null;
  }
  return Math.floor((obtainedNumber / maxNumber) * 100 + 0.5);
}

function gradeFromPercent(pct) {
  const value = Number(pct);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  const band = ACHIEVEMENT_GUIDE.find(({ min, max }) => value >= min && value <= max);
  if (!band) return null;
  return { grade: band.grade, gradePoint: band.gradePoint, stars: band.stars };
}

export function gradeFromMarks(obtained, max) {
  const percent = percentFromMarks(obtained, max);
  return percent == null ? null : gradeFromPercent(percent);
}
