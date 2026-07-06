import Modal from "./Modal.jsx";
import { Button, Spinner } from "./ui.jsx";
import { Icon } from "./Icons.jsx";

export default function ConfirmDialog({ open, title, message, onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      title={title || "Confirm"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy && <Spinner size="sm" className="border-white/40 border-t-white" />}
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Icon name="alert" className="h-5 w-5" />
        </div>
        <p className="pt-1.5 text-sm text-slate-600">{message}</p>
      </div>
    </Modal>
  );
}
