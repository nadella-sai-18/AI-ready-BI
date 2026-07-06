import CrudPage from "../components/CrudPage.jsx";
import { Badge } from "../components/ui.jsx";

export default function AcademicYears() {
  return (
    <CrudPage
      title="Academic Years"
      singular="Academic Year"
      description="Manage academic years / admission batches (e.g. 2024-2025)."
      path="/academic-years"
      idKey="academic_year_id"
      searchable
      titleField="year_label"
      columns={[
        { key: "academic_year_id", label: "ID", sortable: true },
        {
          key: "year_label",
          label: "Academic Year",
          sortable: true,
          render: (r) => <Badge tone="indigo">{r.year_label}</Badge>,
        },
        { key: "start_year", label: "Start", sortable: true },
        { key: "end_year", label: "End", sortable: true },
      ]}
      createFields={[
        { name: "year_label", label: "Label (e.g. 2024-2025)", type: "text", required: true },
        { name: "start_year", label: "Start Year", type: "number", min: 1900, max: 2100 },
        { name: "end_year", label: "End Year", type: "number", min: 1900, max: 2100 },
      ]}
    />
  );
}
