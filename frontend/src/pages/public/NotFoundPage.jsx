import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { useMeta } from '../../hooks/useMeta.js';

export default function NotFoundPage() {
  useMeta({ title: 'Page not found', noindex: true });
  return (
    <div className="container page not-found">
      <p className="not-found__code" aria-hidden="true">
        404
      </p>
      <h1>This page is off the playlist</h1>
      <p className="text-muted">The page you are looking for does not exist or has moved.</p>
      <div className="row-gap wrap center">
        <Link to="/" className="btn btn--primary">
          <Icon name="home" size={16} /> Go home
        </Link>
        <Link to="/discover" className="btn btn--secondary">
          <Icon name="compass" size={16} /> Discover music
        </Link>
      </div>
    </div>
  );
}
