import CrudPage from "../components/CrudPage.jsx";
import { Badge } from "../components/ui.jsx";

export default function Programs() {
  return (
    <CrudPage
      title="Branches"
      description="Manage B.Tech branches (e.g. Computer Science, ECE, Civil, Mechanical)."
      path="/programs"
      idKey="program_id"
      searchable
      titleField="program_name"
      columns={[
        { key: "program_id", label: "ID", sortable: true },
        {
          key: "program_name",
          label: "Branch",
          sortable: true,
          render: (r) => <span className="font-medium text-slate-800">{r.program_name}</span>,
        },
        {
          key: "duration_years",
          label: "Duration",
          sortable: true,
          render: (r) =>
            r.duration_years ? (
              <Badge tone="slate">{r.duration_years} years</Badge>
            ) : (
              "—"
            ),
        },
      ]}
      createFields={[
        { name: "program_name", label: "Branch Name", type: "text", required: true },
        { name: "duration_years", label: "Duration (years)", type: "number", min: 1, max: 10 },
      ]}
    />
  );
}
