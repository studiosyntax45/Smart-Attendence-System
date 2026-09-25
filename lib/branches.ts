/** PES B.Tech branches (pes.edu/btech); anything else goes through "Other". */
export const PES_BRANCHES = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "CSE-AIML", name: "CSE (Artificial Intelligence & Machine Learning)" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "EEE", name: "Electrical & Electronics Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "BT", name: "Biotechnology" },
] as const;

export const OTHER_BRANCH = "__other__";

export function isStandardBranch(value: string): boolean {
  return PES_BRANCHES.some((b) => b.code === value);
}
