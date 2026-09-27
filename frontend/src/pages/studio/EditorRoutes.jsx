import { useParams } from 'react-router-dom';
import SongEditor from '../../components/content/SongEditor.jsx';
import LyricsEditor from '../../components/lyrics/LyricsEditor.jsx';
import VideoEditor from '../../components/videos/VideoEditor.jsx';
import { useMeta } from '../../hooks/useMeta.js';

/** Route wrappers so Studio and Admin share one editor per content type. */
export function StudioSongRoute() {
  const { id } = useParams();
  useMeta({ title: id ? 'Edit song · Studio' : 'Upload music · Studio', noindex: true });
  return <SongEditor key={id || 'new'} scope="studio" id={id} />;
}

export function LyricsRoute({ scope }) {
  const { songId } = useParams();
  useMeta({ title: 'Lyrics editor', noindex: true });
  return <LyricsEditor key={songId} scope={scope} songId={songId} />;
}

export function VideoRoute({ scope }) {
  const { id } = useParams();
  useMeta({ title: id ? 'Edit music video' : 'New music video', noindex: true });
  return <VideoEditor key={id || 'new'} scope={scope} id={id} />;
}
