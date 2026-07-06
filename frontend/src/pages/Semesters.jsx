import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { Badge, Button, Card, Input, Label, PageHeader, Select, Spinner } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";

const TERMS = ["Monsoon", "Winter"];
const STATUSES = ["Active", "Completed", "Upcoming"];
const termTone = { Monsoon: "amber", Winter: "blue" };
const statusTone = { Active: "green", Upcoming: "amber", Completed: "slate" };

// Derive academic fields from the semester number (real B.Tech mapping).
const deriveYear = (n) => (n ? Math.floor((Number(n) + 1) / 2) : "");
const deriveTerm = (n) => (n ? (Number(n) % 2 === 1 ? "Monsoon" : "Winter") : "");
const derivePeriod = (n) => (n ? (Number(n) % 2 === 1 ? "Jul-Nov" : "Dec-Apr") : "");

const emptyForm = { semester_number: "", semester_name: "", btech_year: "", term_type: "", academic_period: "", status: "Upcoming", is_current: false };

export default function Semesters() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({ btech_year: "", term_type: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [settingCurrent, setSettingCurrent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get("/semesters", { params: { limit: 50, sort_by: "semester_number", order: "asc" } });
      setRows(data.items || []);
    } catch (err) {
      setError(err.userMessage || "Failed to load semesters");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) =>
    (!filters.btech_year || String(r.btech_year) === filters.btech_year) &&
    (!filters.term_type || r.term_type === filters.term_type) &&
    (!filters.status || r.status === filters.status)
  ), [rows, filters]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setModalOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      semester_number: r.semester_number ?? "", semester_name: r.semester_name ?? "",
      btech_year: r.btech_year ?? "", term_type: r.term_type ?? "",
      academic_period: r.academic_period ?? "", status: r.status ?? "Upcoming",
      is_current: !!r.is_current,
    });
    setFormError(null); setModalOpen(true);
  };

  // When the number changes on a NEW semester, auto-fill the derived fields.
  const onNumber = (v) => setForm((f) => ({
    ...f, semester_number: v,
    semester_name: f.semester_name || (v ? `Semester ${v}` : ""),
    btech_year: deriveYear(v), term_type: deriveTerm(v), academic_period: derivePeriod(v),
  }));

  const save = async () => {
    setFormError(null);
    if (!form.semester_number) return setFormError("Semester Number (1-8) is required.");
    const payload = {
      semester_number: Number(form.semester_number),
      semester_name: form.semester_name || `Semester ${form.semester_number}`,
      btech_year: form.btech_year ? Number(form.btech_year) : deriveYear(form.semester_number),
      term_type: form.term_type || deriveTerm(form.semester_number),
      academic_period: form.academic_period || derivePeriod(form.semester_number),
      status: form.status || "Upcoming",
      is_current: !!form.is_current,
    };
    setSaving(true);
    try {
      if (editing) { await api.put(`/semesters/${editing.semester_id}`, payload); toast.success("Semester updated"); }
      else { await api.post("/semesters", payload); toast.success("Semester created"); }
      setModalOpen(false); await load();
    } catch (err) {
      setFormError(err.userMessage || "Save failed");
    } finally { setSaving(false); }
  };

  const setCurrent = async (r) => {
    setSettingCurrent(r.semester_id);
    try {
      await api.post(`/semesters/${r.semester_id}/set-current`);
      toast.success(`${r.semester_name} is now the current semester`);
      await load();
    } catch (err) {
      toast.error(err.userMessage || "Failed to set current semester");
    } finally { setSettingCurrent(null); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/semesters/${toDelete.semester_id}`);
      toast.success("Semester deleted"); setToDelete(null); await load();
    } catch (err) {
      toast.error(err.userMessage || "Delete failed");
    } finally { setDeleting(false); }
  };

  const columns = [
    {
      key: "semester_name", label: "Semester", sortable: true,
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-slate-800">{r.semester_name}</span>
          {r.is_current && <Badge tone="green" dot>Current</Badge>}
        </span>
      ),
    },
    { key: "btech_year", label: "B.Tech Year", render: (r) => (r.btech_year ? `Year ${r.btech_year}` : "—") },
    { key: "term_type", label: "Academic Term", render: (r) => r.term_type ? <Badge tone={termTone[r.term_type] || "slate"} dot>{r.term_type}</Badge> : "—" },
    { key: "academic_period", label: "Academic Period", render: (r) => r.academic_period || "—" },
    { key: "status", label: "Status", render: (r) => r.status ? <Badge tone={statusTone[r.status] || "slate"}>{r.status}</Badge> : "—" },
    { key: "active_students", label: "Active Students", render: (r) => <span className="tabular-nums text-slate-700">{r.active_students ?? "—"}</span> },
    { key: "courses_offered", label: "Courses Offered", render: (r) => <span className="tabular-nums text-slate-700">{r.courses_offered ?? "—"}</span> },
  ];

  const hasFilters = filters.btech_year || filters.term_type || filters.status;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Semesters"
        subtitle="The 8 academic semesters shared across all branches — 4 years × Monsoon / Winter terms."
        actions={<Button onClick={openCreate}><Icon name="plus" className="h-4 w-4" /> Add Semester</Button>}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <Label>B.Tech Year</Label>
            <Select value={filters.btech_year} onChange={(e) => setFilters((f) => ({ ...f, btech_year: e.target.value }))}>
              <option value="">All years</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </Select>
          </div>
          <div className="min-w-[10rem]">
            <Label>Term</Label>
            <Select value={filters.term_type} onChange={(e) => setFilters((f) => ({ ...f, term_type: e.target.value }))}>
              <option value="">All terms</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="min-w-[10rem]">
            <Label>Status</Label>
            <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={() => setFilters({ btech_year: "", term_type: "", status: "" })}>
              <Icon name="x" className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        error={error}
        emptyText="No semesters match these filters"
        actions={(r) => (
          <>
            {!r.is_current && (
              <Button variant="secondary" size="sm" onClick={() => setCurrent(r)} disabled={settingCurrent === r.semester_id}>
                {settingCurrent === r.semester_id ? <Spinner size="sm" /> : <Icon name="checkCircle" className="h-3.5 w-3.5" />} Set Current
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => openEdit(r)}><Icon name="edit" className="h-3.5 w-3.5" /> Edit</Button>
            <Button variant="danger" size="sm" onClick={() => setToDelete(r)}><Icon name="trash" className="h-3.5 w-3.5" /></Button>
          </>
        )}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Edit Semester" : "Add Semester"}
        subtitle={editing ? editing.semester_name : "Semesters are shared across all programs (1–8)"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Spinner size="sm" className="border-white/40 border-t-white" />}{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" /><span>{formError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <Label required>Semester Number (1–8)</Label>
              <Input type="number" min="1" max="8" value={form.semester_number}
                disabled={!!editing}
                onChange={(e) => onNumber(e.target.value)} />
              {editing && <p className="mt-1 text-xs text-slate-400">Number can't be changed on an existing semester.</p>}
            </div>
            <div>
              <Label>Semester Name</Label>
              <Input value={form.semester_name} onChange={(e) => setForm((f) => ({ ...f, semester_name: e.target.value }))} placeholder="Semester 1" />
            </div>
            <div>
              <Label>B.Tech Year</Label>
              <Select value={form.btech_year} onChange={(e) => setForm((f) => ({ ...f, btech_year: e.target.value }))}>
                <option value="">Auto</option>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </Select>
            </div>
            <div>
              <Label>Academic Term</Label>
              <Select value={form.term_type} onChange={(e) => setForm((f) => ({ ...f, term_type: e.target.value }))}>
                <option value="">Auto</option>
                {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <Label>Academic Period</Label>
              <Input value={form.academic_period} onChange={(e) => setForm((f) => ({ ...f, academic_period: e.target.value }))} placeholder="Jul-Nov" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.is_current}
                  onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
                Mark as the current operational semester
              </label>
              <p className="mt-1 text-xs text-slate-400">Only one semester can be current — setting this clears the others.</p>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete Semester"
        message={`Delete "${toDelete?.semester_name}"? Courses in this semester would block deletion.`}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
        busy={deleting}
      />
    </div>
  );
}
