import CrudPage from "../components/CrudPage.jsx";
import { Badge } from "../components/ui.jsx";

export default function Faculty() {
  return (
    <CrudPage
      title="Faculty"
      description="Manage faculty members and their departments."
      path="/faculty"
      idKey="faculty_id"
      searchable
      titleField="full_name"
      columns={[
        { key: "faculty_id", label: "ID", sortable: true },
        {
          key: "full_name",
          label: "Name",
          sortable: true,
          render: (r) => (
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                {(r.full_name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-slate-800">{r.full_name || "—"}</span>
            </div>
          ),
        },
        {
          key: "email",
          label: "Email",
          sortable: true,
          render: (r) => (r.email ? <span className="text-slate-500">{r.email}</span> : "—"),
        },
        {
          key: "department",
          label: "Department",
          sortable: true,
          render: (r) => (r.department ? <Badge tone="indigo">{r.department}</Badge> : "—"),
        },
      ]}
      createFields={[
        { name: "full_name", label: "Full Name", type: "text", required: true },
        { name: "email", label: "Email", type: "email" },
        { name: "department", label: "Department", type: "text" },
      ]}
    />
  );
}
