import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { useMeta } from '../../hooks/useMeta.js';
import { userService } from '../../services/userService.js';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';

export default function FavoritesPage() {
  useMeta({ title: 'Favorites', noindex: true });
  const { favoriteIds } = useLibrary();
  const { playList } = usePlayer();
  const fetchPage = useCallback((page) => userService.favorites({ page, limit: 50 }), []);
  const list = usePaginatedList(fetchPage, []);
  const { setItems } = list;

  // Songs un-favorited from this page (or elsewhere) disappear immediately.
  useEffect(() => {
    setItems((items) => items.filter((s) => favoriteIds.has(s.id)));
  }, [favoriteIds, setItems]);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your library</p>
          <h1 className="page-title">
            <Icon name="heart-filled" size={28} className="text-gold" /> Favorites
          </h1>
          <p className="text-muted">{favoriteIds.size} {favoriteIds.size === 1 ? 'song' : 'songs'}</p>
        </div>
        {list.items.length ? (
          <button type="button" className="btn btn--primary" onClick={() => playList(list.items, 0)}>
            <Icon name="play" size={16} /> Play all
          </button>
        ) : null}
      </header>

      {list.error && !list.items.length ? (
        <ErrorState error={list.error} onRetry={list.reset} />
      ) : list.initialLoading ? (
        <RowSkeletons />
      ) : !list.items.length ? (
        <EmptyState
          icon="heart"
          title="No favorites yet"
          message="Tap the heart on any song to save it here."
          action={
            <Link to="/discover" className="btn btn--secondary">
              Discover music
            </Link>
          }
        />
      ) : (
        <>
          <SongList songs={list.items} label="Favorite songs" />
          <LoadMore hasMore={list.hasMore} loading={list.loading} error={list.error} onLoadMore={list.loadMore} onRetry={list.retry} />
        </>
      )}
    </div>
  );
}
