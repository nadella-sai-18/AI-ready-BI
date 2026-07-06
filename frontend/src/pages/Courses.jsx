import CrudPage from "../components/CrudPage.jsx";
import { Badge } from "../components/ui.jsx";

const PROGRAM_OPT = { path: "/programs", valueKey: "program_id", labelKey: "program_name" };
const SEMESTER_OPT = { path: "/semesters", valueKey: "semester_id", labelKey: "semester_name" };
const FACULTY_OPT = { path: "/faculty", valueKey: "faculty_id", labelKey: "full_name" };

export default function Courses() {
  return (
    <CrudPage
      title="Courses"
      description="Manage subjects — linked to a branch, semester, and an assigned faculty."
      path="/courses"
      idKey="course_id"
      searchable
      titleField="course_name"
      columns={[
        { key: "course_id", label: "ID", sortable: true },
        {
          key: "course_code",
          label: "Code",
          sortable: true,
          render: (r) =>
            r.course_code ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                {r.course_code}
              </span>
            ) : (
              "—"
            ),
        },
        {
          key: "course_name",
          label: "Course",
          sortable: true,
          render: (r) => <span className="font-medium text-slate-800">{r.course_name}</span>,
        },
        {
          key: "program_name",
          label: "Branch",
          render: (r) => <span className="text-slate-500">{r.program_name || "—"}</span>,
        },
        {
          key: "semester_name",
          label: "Semester",
          render: (r) => <span className="text-slate-500">{r.semester_name || "—"}</span>,
        },
        {
          key: "faculty_name",
          label: "Faculty",
          render: (r) =>
            r.faculty_name ? (
              <span className="text-slate-700">{r.faculty_name}</span>
            ) : (
              <span className="text-slate-400">Unassigned</span>
            ),
        },
        {
          key: "credits",
          label: "Credits",
          sortable: true,
          render: (r) => (r.credits != null ? <Badge tone="slate">{r.credits}</Badge> : "—"),
        },
      ]}
      filters={[
        { name: "program_id", label: "Branch", type: "select", options: PROGRAM_OPT },
        { name: "semester_id", label: "Semester", type: "select", options: SEMESTER_OPT },
        { name: "faculty_id", label: "Faculty", type: "select", options: FACULTY_OPT },
      ]}
      createFields={[
        { name: "course_code", label: "Course Code", type: "text" },
        { name: "course_name", label: "Course Name", type: "text", required: true, full: true },
        { name: "program_id", label: "Branch", type: "select-number", required: true, options: PROGRAM_OPT },
        { name: "semester_id", label: "Semester", type: "select-number", required: true, options: SEMESTER_OPT },
        { name: "faculty_id", label: "Assigned Faculty", type: "select-number", options: FACULTY_OPT },
        { name: "credits", label: "Credits", type: "number", min: 0, max: 20 },
      ]}
    />
  );
}
