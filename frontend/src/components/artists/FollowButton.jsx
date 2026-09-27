import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { musicService } from '../../services/musicService.js';
import { cx, formatCount } from '../../utils/format.js';

export function VerifiedBadge({ size = 16 }) {
  return (
    <span className="verified" title="Verified artist">
      <Icon name="badge-check" size={size} />
      <span className="sr-only">Verified artist</span>
    </span>
  );
}

/** Follow / unfollow an artist. Guests are sent to sign in; owners can't follow themselves. */
export default function FollowButton({ artist, onChange, size }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [following, setFollowing] = useState(Boolean(artist.isFollowing));
  const [count, setCount] = useState(artist.followerCount || 0);
  const [busy, setBusy] = useState(false);

  if (artist.isOwner) return null;

  const toggle = async () => {
    if (!user) {
      toast.info('Sign in to follow artists.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    try {
      const { data } = following ? await musicService.unfollow(artist.id) : await musicService.follow(artist.id);
      setFollowing(data.following);
      setCount(data.followerCount);
      onChange?.(data);
      toast.success(data.following ? `You're following ${artist.name}.` : `You unfollowed ${artist.name}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={cx('btn', following ? 'btn--secondary' : 'btn--primary', size === 'sm' && 'btn--sm')}
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${artist.name} (${formatCount(count)} followers)` : `Follow ${artist.name} (${formatCount(count)} followers)`}
    >
      <Icon name={following ? 'user-check' : 'user-plus'} size={16} />
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
