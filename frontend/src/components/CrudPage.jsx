import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client.js";
import { useToast } from "./Toast.jsx";
import DataTable from "./DataTable.jsx";
import Modal from "./Modal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { Button, Card, Input, Label, PageHeader, Select, Spinner } from "./ui.jsx";
import { Icon } from "./Icons.jsx";

/**
 * Configuration-driven CRUD page with SERVER-SIDE pagination + sorting.
 * Every network call hits the real FastAPI backend — no local/mock data.
 * List endpoints return a Page envelope: { items, total, skip, limit }.
 *
 * Props: title, description, singular, path, idKey, columns, createFields,
 * editFields, searchable, filters, titleField. See fieldDef/filterDef inline.
 */
const PAGE_SIZES = [10, 25, 50];

export default function CrudPage({
  title,
  description,
  singular,
  path,
  idKey,
  columns,
  createFields,
  editFields,
  searchable = false,
  filters = [],
  titleField,
  fixedParams = {},       // always-applied query params (locked filters)
  createDefaults = {},    // merged into the create payload (for fields not in the form)
  headerRight = null,     // optional extra header content (e.g. a Back button)
}) {
  const toast = useToast();
  const editingFields = editFields || createFields;
  const noun = singular || title.replace(/s$/, "");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState({});
  const [optionsMap, setOptionsMap] = useState({});

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState(null);
  const [order, setOrder] = useState("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const activeFields = editing ? editingFields : createFields;

  // Debounce the search box into `search` (350ms) to avoid a request per keystroke.
  const searchTimer = useRef(null);
  useEffect(() => {
    searchTimer.current = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchInput]);

  const filterKey = JSON.stringify(filterState);
  const fixedKey = JSON.stringify(fixedParams);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...fixedParams, skip: (page - 1) * pageSize, limit: pageSize };
      if (searchable && search) params.search = search;
      if (sortBy) {
        params.sort_by = sortBy;
        params.order = order;
      }
      for (const f of filters) {
        if (filterState[f.name] !== undefined && filterState[f.name] !== "") {
          params[f.name] = filterState[f.name];
        }
      }
      const { data } = await api.get(path, { params });
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.userMessage || "Failed to load data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, searchable, search, sortBy, order, page, pageSize, filterKey, fixedKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when the result set changes shape.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterKey, pageSize, sortBy, order]);

  // Load select options for form fields AND filters (once). Reads Page.items.
  useEffect(() => {
    const withOptions = [...createFields, ...(editFields || []), ...filters].filter(
      (f) => f.options
    );
    const unique = {};
    withOptions.forEach((f) => (unique[f.options.path] = f.options));
    Object.entries(unique).forEach(async ([optPath, opt]) => {
      try {
        const { data } = await api.get(optPath, { params: { limit: 500 } });
        const list = Array.isArray(data) ? data : data.items || [];
        setOptionsMap((m) => ({
          ...m,
          [optPath]: list.map((d) => ({
            value: d[opt.valueKey],
            label: `${d[opt.valueKey]} — ${d[opt.labelKey] ?? ""}`.trim(),
          })),
        }));
      } catch {
        setOptionsMap((m) => ({ ...m, [optPath]: [] }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const onSort = (key) => {
    if (sortBy === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setOrder("asc");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    const initial = {};
    editingFields.forEach((f) => (initial[f.name] = row[f.name] ?? ""));
    setForm(initial);
    setFormError(null);
    setModalOpen(true);
  };

  const serialize = () => {
    const payload = {};
    for (const f of activeFields) {
      let v = form[f.name];
      if (v === "" || v === undefined || v === null) {
        if (f.required) throw new Error(`${f.label} is required`);
        continue;
      }
      if (f.type === "number" || f.type === "select-number") v = Number(v);
      payload[f.name] = v;
    }
    return payload;
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = serialize();
      if (editing) {
        await api.put(`${path}/${editing[idKey]}`, payload);
        toast.success(`${noun} updated`);
      } else {
        await api.post(path, { ...createDefaults, ...payload });
        toast.success(`${noun} created`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.userMessage || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`${path}/${toDelete[idKey]}`);
      toast.success(`${noun} deleted`);
      setToDelete(null);
      // If we deleted the last row on a page, step back a page.
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
    } catch (err) {
      toast.error(err.userMessage || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const renderControl = (f, value, set) => {
    if (f.type === "select" || f.type === "select-number") {
      const opts = optionsMap[f.options.path] || [];
      return (
        <Select value={value} onChange={(e) => set(e.target.value)}>
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    }
    if (f.type === "static-select") {
      return (
        <Select value={value} onChange={(e) => set(e.target.value)}>
          <option value="">Select…</option>
          {f.choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <Input
        type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type || "text"}
        value={value}
        min={f.min}
        max={f.max}
        step={f.step}
        onChange={(e) => set(e.target.value)}
      />
    );
  };

  const deleteLabel = useMemo(() => {
    if (!toDelete) return "";
    return titleField ? toDelete[titleField] : `#${toDelete[idKey]}`;
  }, [toDelete, titleField, idKey]);

  const hasActiveFilters = search || Object.values(filterState).some((v) => v);

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={description}
        actions={
          <>
            {headerRight}
            <Button onClick={openCreate}>
              <Icon name="plus" className="h-4 w-4" /> Add {noun}
            </Button>
          </>
        }
      />

      {(searchable || filters.length > 0) && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {searchable && (
              <div className="min-w-[14rem] flex-1">
                <Label>Search</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Icon name="search" className="h-4 w-4" />
                  </span>
                  <Input
                    className="pl-9"
                    placeholder={`Search ${title.toLowerCase()}…`}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </div>
            )}
            {filters.map((f) => (
              <div key={f.name} className="min-w-[11rem]">
                <Label>{f.label}</Label>
                {renderControl(f, filterState[f.name] ?? "", (val) =>
                  setFilterState((s) => ({ ...s, [f.name]: val }))
                )}
              </div>
            ))}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setFilterState({});
                }}
              >
                <Icon name="x" className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        sortBy={sortBy}
        order={order}
        onSort={onSort}
        actions={(row) => (
          <>
            <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
              <Icon name="edit" className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setToDelete(row)}>
              <Icon name="trash" className="h-3.5 w-3.5" /> Delete
            </Button>
          </>
        )}
      />

      {!loading && !error && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="ml-2 text-slate-500">
              Showing{" "}
              <b className="text-slate-700">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </b>{" "}
              of <b className="text-slate-700">{total}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="px-1 text-slate-500">
              Page <b className="text-slate-700">{page}</b> / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={`${editing ? "Edit" : "Add"} ${noun}`}
        subtitle={editing ? `Update details for #${editing[idKey]}` : `Create a new ${noun.toLowerCase()}`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {activeFields.map((f) => (
              <div key={f.name} className={f.full ? "sm:col-span-2" : ""}>
                <Label required={f.required}>{f.label}</Label>
                {renderControl(f, form[f.name] ?? "", (val) =>
                  setForm((s) => ({ ...s, [f.name]: val }))
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${noun}`}
        message={`Are you sure you want to delete "${deleteLabel}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
        busy={deleting}
      />
    </div>
  );
}
