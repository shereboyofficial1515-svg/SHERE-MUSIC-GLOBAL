import { Link, useParams } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import Section from '../../components/music/Section.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import { ArtistCard, PlaylistCard } from '../../components/music/Cards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';
import { formatDate } from '../../utils/format.js';
import { ArtistBadge } from '../../components/plus/PlusBadge.jsx';

/** Public listener profile. Everything shown respects the owner's privacy settings (enforced by the API). */
export default function UserProfilePage() {
  const { username } = useParams();
  const { data: profile, loading, error, reload } = useAsync(() => musicService.profile(username), [username]);
  useMeta({ title: profile ? `${profile.name} on SHERE MUSIC` : 'Profile', description: profile?.bio || undefined, image: profile?.avatarUrl, type: 'profile' });

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? <EmptyState icon="user" title="Profile not available" message="This profile is private or doesn't exist." /> : <ErrorState error={error} onRetry={reload} />}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="container page">
        <Skeleton height={140} radius={20} />
      </div>
    );
  }

  const socials = Object.entries(profile.socialLinks || {}).filter(([, v]) => v);
  return (
    <div className="container page">
      <header className="profile-head">
        <Artwork src={profile.avatarUrl} alt={`${profile.name}'s profile picture`} rounded size={120} icon="user" className="profile-head__avatar" />
        <div className="profile-head__info">
          <p className="eyebrow">{profile.isArtist ? 'Artist · Listener' : 'Listener'}</p>
          <h1 className="page-title">
            {profile.name} {profile.isArtist ? <ArtistBadge /> : null}
          </h1>
          <p className="text-muted">
            {profile.username ? `@${profile.username} · ` : ''}
            {profile.location ? `${profile.location} · ` : ''}Joined {formatDate(profile.createdAt, { year: 'numeric', month: 'long' })}
          </p>
          {profile.bio ? <p className="prose">{profile.bio}</p> : null}
          <div className="row-gap wrap">
            {profile.website ? (
              <a className="btn btn--ghost btn--sm" href={profile.website} target="_blank" rel="noopener noreferrer">
                <Icon name="link" size={14} /> Website
              </a>
            ) : null}
            {socials.map(([k, url]) => (
              <a key={k} className="btn btn--ghost btn--sm" href={url} target="_blank" rel="noopener noreferrer">
                <Icon name="external-link" size={14} /> {k}
              </a>
            ))}
            {profile.isSelf ? (
              <Link to="/settings/profile" className="btn btn--secondary btn--sm">
                <Icon name="edit" size={14} /> Edit profile
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {profile.artistProfiles.length ? (
        <Section title="Artist profiles">
          {profile.artistProfiles.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Section>
      ) : null}
      {profile.recentlyPlayed?.length ? (
        <Section title="Recently played">
          {profile.recentlyPlayed.map((s) => (
            <SongCard key={s.id} song={s} list={profile.recentlyPlayed} />
          ))}
        </Section>
      ) : null}
      {profile.playlists.length ? (
        <Section title="Public playlists">
          {profile.playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Section>
      ) : null}
      {profile.following?.length ? (
        <Section title="Following">
          {profile.following.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Section>
      ) : null}
      {!profile.playlists.length && !profile.following?.length && !profile.recentlyPlayed?.length && !profile.artistProfiles.length ? (
        <div className="section">
          <EmptyState icon="user" title="Nothing to show yet" message={profile.isSelf ? 'Make playlists public or share your listening activity in Settings → Privacy.' : undefined} />
        </div>
      ) : null}
    </div>
  );
}
