import { useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField, Toggle } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../../components/admin/AdminUI.jsx';
import { PlusBadge } from '../../components/plus/PlusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService, toFormData } from '../../services/adminService.js';
import { checkFile } from '../../utils/audio.js';
import { formatDateTime } from '../../utils/format.js';

// <input type="datetime-local"> works in local time; the API stores ISO timestamps.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

function OfferForm({ offer, onClose, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState({
    title: offer?.title || '',
    description: offer?.description || '',
    linkUrl: offer?.linkUrl || '',
    linkLabel: offer?.linkLabel || '',
    startsAt: toLocalInput(offer?.startsAt),
    endsAt: toLocalInput(offer?.endsAt),
    isActive: offer?.isActive ?? true,
    plusOnly: offer?.plusOnly ?? true,
    sortOrder: offer?.sortOrder ?? 0,
  });
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setErrors({ title: 'Add a title.' });
    setBusy(true);
    try {
      const body = toFormData(
        {
          title: form.title.trim(),
          description: form.description.trim() || null,
          linkUrl: form.linkUrl.trim() || null,
          linkLabel: form.linkLabel.trim() || null,
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          isActive: form.isActive,
          plusOnly: form.plusOnly,
          sortOrder: Number(form.sortOrder) || 0,
          ...(removeImage && !image ? { removeImage: true } : {}),
        },
        { image }
      );
      const res = offer ? await adminService.updateOffer(offer.id, body) : await adminService.createOffer(body);
      toast.success(offer ? 'Offer saved.' : 'Offer created.');
      onSaved(res.data);
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={offer ? 'Edit offer' : 'New Plus offer'}
      onClose={onClose}
      size="md"
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="offer-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save offer'}
          </button>
        </>
      }
    >
      <form id="offer-form" className="stack" onSubmit={save} noValidate>
        <TextField label="Offer title" value={form.title} onChange={set('title')} error={errors.title} maxLength={120} required />
        <TextArea label="Description" value={form.description} onChange={set('description')} error={errors.description} rows={3} maxLength={1000} hint="Only describe benefits that actually exist." />
        <ImagePicker
          label="Image"
          currentUrl={removeImage ? null : offer?.imageUrl}
          file={image}
          removed={removeImage}
          onChange={(file) => {
            const problem = file ? checkFile(file, 'image', settings.maxImageMb) : null;
            if (problem) return toast.error(problem);
            setImage(file);
            setRemoveImage(false);
          }}
          onRemove={() => {
            setImage(null);
            setRemoveImage(true);
          }}
          hint="16:9 JPG, PNG or WebP."
        />
        <div className="form-row">
          <TextField label="Link" value={form.linkUrl} onChange={set('linkUrl')} error={errors.linkUrl} placeholder="https:// or /path" />
          <TextField label="Button label" value={form.linkLabel} onChange={set('linkLabel')} error={errors.linkLabel} maxLength={40} placeholder="Open offer" />
        </div>
        <div className="form-row">
          <TextField label="Starts" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} error={errors.startsAt} hint="Empty = now" />
          <TextField label="Ends" type="datetime-local" value={form.endsAt} onChange={set('endsAt')} error={errors.endsAt} hint="Empty = no end" />
        </div>
        <TextField label="Order" type="number" min={0} max={1000} value={form.sortOrder} onChange={set('sortOrder')} hint="Lower numbers show first." />
        <Toggle label="Active" description="Inactive offers are hidden from everyone." checked={form.isActive} onChange={set('isActive')} />
        <Toggle label="Plus only" description="Only Plus members see the details and link. Others see the title with a Plus prompt." checked={form.plusOnly} onChange={set('plusOnly')} />
      </form>
    </Dialog>
  );
}

export default function OffersPage() {
  useMeta({ title: 'Plus offers · Admin', noindex: true });
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => adminService.offers(), []);
  const [editing, setEditing] = useState(null); // offer | 'new' | null
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await adminService.deleteOffer(toDelete.id);
      setData((list) => list.filter((o) => o.id !== toDelete.id));
      toast.success('Offer deleted.');
      setToDelete(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();
  const state = (o) =>
    !o.isActive ? 'Inactive' : o.startsAt && Date.parse(o.startsAt) > now ? 'Scheduled' : o.endsAt && Date.parse(o.endsAt) <= now ? 'Ended' : 'Live';

  return (
    <>
      <AdminHeader
        title="Plus offers"
        description="Offers shown on the SHERE MUSIC Plus page."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New offer
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
        <EmptyState icon="gift" title="No offers yet" message="Create an offer for Plus members." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Offer</th>
                <th scope="col">Status</th>
                <th scope="col" className="hide-sm">Starts</th>
                <th scope="col" className="hide-sm">Ends</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="table__title">
                      {o.title} {o.plusOnly ? <PlusBadge /> : null}
                    </span>
                    {o.description ? <span className="text-muted text-sm">{o.description.slice(0, 80)}</span> : null}
                  </td>
                  <td>{state(o)}</td>
                  <td className="hide-sm text-muted">{o.startsAt ? formatDateTime(o.startsAt) : '—'}</td>
                  <td className="hide-sm text-muted">{o.endsAt ? formatDateTime(o.endsAt) : '—'}</td>
                  <td>
                    <div className="table__actions">
                      <button type="button" className="icon-btn" onClick={() => setEditing(o)} aria-label={`Edit ${o.title}`}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(o)} aria-label={`Delete ${o.title}`}>
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
        <OfferForm
          offer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((list) => (list.some((o) => o.id === saved.id) ? list.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...list]));
            setEditing(null);
          }}
        />
      ) : null}
      {toDelete ? (
        <ConfirmDialog title="Delete offer?" message={`"${toDelete.title}" will be removed from the Plus page.`} confirmLabel="Delete offer" danger busy={busy} onConfirm={remove} onClose={() => setToDelete(null)} />
      ) : null}
    </>
  );
}
