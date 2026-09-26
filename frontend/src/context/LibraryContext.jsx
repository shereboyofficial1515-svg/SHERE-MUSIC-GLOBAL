import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { userService } from '../services/userService.js';
import AddToPlaylistDialog from '../components/music/AddToPlaylistDialog.jsx';

const LibraryContext = createContext(null);

/**
 * The signed-in user's library: favorite ids (for heart states everywhere) and
 * the global "Add to playlist" dialog. Guests are sent to sign in.
 */
export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [pending, setPending] = useState(() => new Set());
  const [playlistSong, setPlaylistSong] = useState(null);
  const [playlistsVersion, setPlaylistsVersion] = useState(0);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    userService
      .favoriteIds()
      .then(({ data }) => !cancelled && setFavoriteIds(new Set(data)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requireSignIn = useCallback(
    (message) => {
      toast.info(message);
      navigate('/login', { state: { from: location.pathname + location.search } });
    },
    [toast, navigate, location]
  );

  const toggleFavorite = useCallback(
    async (song) => {
      if (!user) return requireSignIn('Sign in to save songs to your favorites.');
      if (pending.has(song.id)) return;
      const wasFavorite = favoriteIds.has(song.id);
      const update = (add) =>
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (add) next.add(song.id);
          else next.delete(song.id);
          return next;
        });

      update(!wasFavorite); // optimistic
      setPending((p) => new Set(p).add(song.id));
      try {
        if (wasFavorite) await userService.removeFavorite(song.id);
        else await userService.addFavorite(song.id);
        toast.success(wasFavorite ? `Removed "${song.title}" from favorites.` : `Added "${song.title}" to favorites.`);
      } catch (err) {
        update(wasFavorite);
        toast.error(err.message);
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(song.id);
          return next;
        });
      }
    },
    [user, favoriteIds, pending, toast, requireSignIn]
  );

  const openAddToPlaylist = useCallback(
    (song) => {
      if (!user) return requireSignIn('Sign in to create playlists.');
      setPlaylistSong(song);
    },
    [user, requireSignIn]
  );

  const value = useMemo(
    () => ({
      favoriteIds,
      isFavorite: (id) => favoriteIds.has(id),
      toggleFavorite,
      openAddToPlaylist,
      playlistsVersion,
      bumpPlaylists: () => setPlaylistsVersion((v) => v + 1),
    }),
    [favoriteIds, toggleFavorite, openAddToPlaylist, playlistsVersion]
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
      {playlistSong ? (
        <AddToPlaylistDialog
          song={playlistSong}
          onClose={() => setPlaylistSong(null)}
          onChanged={() => setPlaylistsVersion((v) => v + 1)}
        />
      ) : null}
    </LibraryContext.Provider>
  );
}

export const useLibrary = () => useContext(LibraryContext);
