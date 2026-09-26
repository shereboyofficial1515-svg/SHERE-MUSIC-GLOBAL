import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout, { ScrollToTop } from './layouts/MainLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { GuestOnly, RequireAdmin, RequireAuth } from './components/layout/Guards.jsx';
import MaintenanceGate from './components/layout/MaintenanceGate.jsx';
import HomePage from './pages/public/HomePage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';

// Route-level code splitting: only the home page ships in the initial bundle.
const DiscoverPage = lazy(() => import('./pages/public/DiscoverPage.jsx'));
const SearchPage = lazy(() => import('./pages/public/SearchPage.jsx'));
const SongPage = lazy(() => import('./pages/public/SongPage.jsx'));
const ArtistsPage = lazy(() => import('./pages/public/ArtistsPage.jsx'));
const ArtistPage = lazy(() => import('./pages/public/ArtistPage.jsx'));
const AlbumsPage = lazy(() => import('./pages/public/AlbumsPage.jsx'));
const AlbumPage = lazy(() => import('./pages/public/AlbumPage.jsx'));
const GenrePage = lazy(() => import('./pages/public/GenrePage.jsx'));
const PlaylistPage = lazy(() => import('./pages/public/PlaylistPage.jsx'));

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.jsx'));
const CheckEmailPage = lazy(() => import('./pages/auth/CheckEmailPage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage.jsx'));

const FavoritesPage = lazy(() => import('./pages/user/FavoritesPage.jsx'));
const PlaylistsPage = lazy(() => import('./pages/user/PlaylistsPage.jsx'));
const ProfilePage = lazy(() => import('./pages/user/ProfilePage.jsx'));
const AccountPage = lazy(() => import('./pages/user/AccountPage.jsx'));

const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage.jsx'));
const AdminSongs = lazy(() => import('./pages/admin/SongsPage.jsx'));
const AdminSongForm = lazy(() => import('./pages/admin/SongFormPage.jsx'));
const AdminArtists = lazy(() => import('./pages/admin/ArtistsPage.jsx'));
const AdminAlbums = lazy(() => import('./pages/admin/AlbumsPage.jsx'));
const AdminGenres = lazy(() => import('./pages/admin/GenresPage.jsx'));
const AdminPlaylists = lazy(() => import('./pages/admin/PlaylistsPage.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/UsersPage.jsx'));
const AdminUser = lazy(() => import('./pages/admin/UserDetailPage.jsx'));
const AdminDownloads = lazy(() => import('./pages/admin/DownloadsPage.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AnalyticsPage.jsx'));
const AdminReports = lazy(() => import('./pages/admin/ReportsPage.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/SettingsPage.jsx'));

const guard = (Guard, Page) => (
  <Guard>
    <Page />
  </Guard>
);

export default function App() {
  return (
    <>
      <ScrollToTop />
      <MaintenanceGate>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="song/:id" element={<SongPage />} />
            <Route path="artists" element={<ArtistsPage />} />
            <Route path="artists/:id" element={<ArtistPage />} />
            <Route path="albums" element={<AlbumsPage />} />
            <Route path="albums/:id" element={<AlbumPage />} />
            <Route path="genres/:slug" element={<GenrePage />} />
            <Route path="playlists" element={guard(RequireAuth, PlaylistsPage)} />
            <Route path="playlists/:id" element={<PlaylistPage />} />
            <Route path="favorites" element={guard(RequireAuth, FavoritesPage)} />
            <Route path="profile" element={guard(RequireAuth, ProfilePage)} />
            <Route path="account" element={guard(RequireAuth, AccountPage)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="login" element={guard(GuestOnly, LoginPage)} />
            <Route path="register" element={guard(GuestOnly, RegisterPage)} />
            <Route path="check-email" element={<CheckEmailPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="admin" element={guard(RequireAdmin, AdminLayout)}>
            <Route index element={<AdminDashboard />} />
            <Route path="songs" element={<AdminSongs />} />
            <Route path="songs/new" element={<AdminSongForm />} />
            <Route path="songs/:id/edit" element={<AdminSongForm />} />
            <Route path="artists" element={<AdminArtists />} />
            <Route path="albums" element={<AdminAlbums />} />
            <Route path="genres" element={<AdminGenres />} />
            <Route path="playlists" element={<AdminPlaylists />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUser />} />
            <Route path="downloads" element={<AdminDownloads />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </MaintenanceGate>
    </>
  );
}
