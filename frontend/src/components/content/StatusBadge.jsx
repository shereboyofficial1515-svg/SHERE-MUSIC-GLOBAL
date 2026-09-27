import Icon from '../ui/Icon.jsx';

const META = {
  draft: { label: 'Draft', icon: 'edit', tone: 'muted' },
  pending: { label: 'Pending review', icon: 'clock', tone: 'warning' },
  approved: { label: 'Approved', icon: 'check', tone: 'info' },
  published: { label: 'Published', icon: 'eye', tone: 'success' },
  rejected: { label: 'Changes requested', icon: 'x-circle', tone: 'danger' },
};

/** Workflow status with icon + text (never colour alone). */
export default function StatusBadge({ status }) {
  const m = META[status] || META.draft;
  return (
    <span className={`badge badge--${m.tone}`}>
      <Icon name={m.icon} size={12} /> {m.label}
    </span>
  );
}

export const STATUS_OPTIONS = Object.entries(META).map(([value, m]) => ({ value, label: m.label }));
