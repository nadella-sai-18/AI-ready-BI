// Shared exam metadata for the Exams module.

export const EXAM_TYPES = [
  { value: "Internal 1", max: 20 },
  { value: "Internal 2", max: 20 },
  { value: "Mid Sem", max: 50 },
  { value: "End Sem", max: 100 },
  { value: "Lab Internal", max: 50 },
  { value: "Lab External", max: 50 },
  { value: "Observation", max: 10 },
  { value: "Record", max: 10 },
  { value: "Assignment", max: 10 },
  { value: "Quiz", max: 10 },
];

export const EXAM_TYPE_TONE = {
  "Internal 1": "slate",
  "Internal 2": "slate",
  "Mid Sem": "blue",
  "End Sem": "indigo",
  "Lab Internal": "green",
  "Lab External": "green",
  Observation: "amber",
  Record: "amber",
  Assignment: "amber",
  Quiz: "amber",
};

export const STATUS_TONE = {
  Scheduled: "amber",
  Completed: "green",
  Cancelled: "red",
};

export const MARKS_TONE = {
  Entered: "green",
  Partial: "amber",
  Pending: "red",
};

export const TERMS = ["Monsoon", "Winter"];

// (btech_year, term) -> semester number 1..8
export function semesterFrom(year, term) {
  if (!year) return null;
  return (year - 1) * 2 + (term === "Winter" ? 2 : 1);
}
