import { useParams } from 'react-router-dom';
import SongEditor from '../../components/content/SongEditor.jsx';
import { useMeta } from '../../hooks/useMeta.js';

export default function SongFormPage() {
  const { id } = useParams();
  useMeta({ title: id ? 'Edit song · Admin' : 'Upload music · Admin', noindex: true });
  return <SongEditor key={id || 'new'} scope="admin" id={id} />;
}
