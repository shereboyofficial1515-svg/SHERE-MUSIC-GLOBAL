import { useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField } from '../../components/ui/Form.jsx';
import { AdminHeader } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';

function GenreDialog({ genre, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: genre?.name || '', description: genre?.description || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Enter the category name.' });
    setBusy(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || null };
      const { data } = genre ? await adminService.updateGenre(genre.id, body) : await adminService.createGenre(body);
      toast.success(genre ? 'Category updated.' : `Category "${data.name}" created.`);
      onSaved();
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { name: err.message });
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={genre ? 'Edit category' : 'New category'}
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="genre-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="genre-form" className="stack" onSubmit={submit}>
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={60} required autoFocus />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} rows={3} maxLength={500} />
      </form>
    </Dialog>
  );
}

export default function GenresPage() {
  useMeta({ title: 'Categories · Admin', noindex: true });
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminService.genres(), []);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await adminService.deleteGenre(toDelete.id);
      toast.success(`"${toDelete.name}" was deleted.`);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Categories & genres"
        description="Genres shown across the site. Changes appear immediately."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New category
          </button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="tag" title="No categories yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="hide-sm">URL</th>
                <th scope="col" className="num">Songs</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span className="table__title">{g.name}</span>
                    {g.description ? <span className="text-muted text-sm line-clamp-1">{g.description}</span> : null}
                  </td>
                  <td className="hide-sm text-muted">/genres/{g.slug}</td>
                  <td className="num">{g.totalSongCount}</td>
                  <td>
                    <div className="table__actions">
                      <button type="button" className="icon-btn" onClick={() => setEditing(g)} aria-label={`Edit ${g.name}`}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(g)} aria-label={`Delete ${g.name}`}>
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <GenreDialog
          genre={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
      {toDelete ? (
        <ConfirmDialog
          title="Delete category?"
          message={`"${toDelete.name}" will be deleted. Its ${toDelete.totalSongCount} song(s) are kept without a genre.`}
          confirmLabel="Delete category"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
