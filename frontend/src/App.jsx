import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout, { ScrollToTop } from './layouts/MainLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { Navigate } from 'react-router-dom';
import { GuestOnly, RequireAdmin, RequireAuth, RequireCreator } from './components/layout/Guards.jsx';
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
const FollowingPage = lazy(() => import('./pages/user/FollowingPage.jsx'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.jsx'));
const UserProfilePage = lazy(() => import('./pages/public/UserProfilePage.jsx'));
const VideosHomePage = lazy(() => import('./pages/videos/VideosHomePage.jsx'));
const VideosBrowsePage = lazy(() => import('./pages/videos/VideosBrowsePage.jsx'));
const VideoPage = lazy(() => import('./pages/videos/VideoPage.jsx'));
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallbackPage.jsx'));
const ConfirmEmailPage = lazy(() => import('./pages/auth/ConfirmEmailPage.jsx'));
const StudioLayout = lazy(() => import('./layouts/StudioLayout.jsx'));
const StudioWelcomePage = lazy(() => import('./pages/studio/StudioWelcomePage.jsx'));
const StudioOverviewPage = lazy(() => import('./pages/studio/StudioOverviewPage.jsx'));
const StudioMusicPage = lazy(() => import('./pages/studio/StudioMusicPage.jsx'));
const StudioLyricsPage = lazy(() => import('./pages/studio/StudioLyricsPage.jsx'));
const StudioVideosPage = lazy(() => import('./pages/studio/StudioVideosPage.jsx'));
const StudioAlbumsPage = lazy(() => import('./pages/studio/StudioAlbumsPage.jsx'));
const StudioArtistsPage = lazy(() => import('./pages/studio/StudioArtistsPage.jsx'));
const StudioInsights = import('./pages/studio/StudioInsightsPages.jsx');
const StudioAnalyticsPage = lazy(() => StudioInsights.then((m) => ({ default: m.StudioAnalyticsPage })));
const StudioFollowersPage = lazy(() => StudioInsights.then((m) => ({ default: m.StudioFollowersPage })));
const StudioProfilePage = lazy(() => StudioInsights.then((m) => ({ default: m.StudioProfilePage })));
const StudioSettingsPage = lazy(() => StudioInsights.then((m) => ({ default: m.StudioSettingsPage })));
const Editors = import('./pages/studio/EditorRoutes.jsx');
const StudioSongRoute = lazy(() => Editors.then((m) => ({ default: m.StudioSongRoute })));
const LyricsRoute = lazy(() => Editors.then((m) => ({ default: m.LyricsRoute })));
const VideoRoute = lazy(() => Editors.then((m) => ({ default: m.VideoRoute })));
const AdminReviews = lazy(() => import('./pages/admin/ReviewsPage.jsx'));
const AdminLyrics = lazy(() => import('./pages/admin/LyricsPage.jsx'));
const AdminSubtitles = lazy(() => import('./pages/admin/SubtitlesPage.jsx'));
const AdminVideos = lazy(() => import('./pages/studio/StudioVideosPage.jsx').then((m) => ({ default: () => <m.VideoList scope="admin" /> })));

const PlusPage = lazy(() => import('./pages/plus/PlusPage.jsx'));
const PaymentReturnPage = lazy(() => import('./pages/plus/PaymentReturnPage.jsx'));
const StudioSubmitPage = lazy(() => import('./pages/studio/StudioSubmitPage.jsx'));
const StudioPaymentsPage = lazy(() => import('./pages/studio/StudioPaymentsPage.jsx'));
const AdminMonetization = lazy(() => import('./pages/admin/MonetizationPage.jsx'));
const AdminPayments = lazy(() => import('./pages/admin/PaymentsPage.jsx'));
const AdminPlusMembers = lazy(() => import('./pages/admin/PlusMembersPage.jsx'));
const AdminSubmissions = lazy(() => import('./pages/admin/SubmissionsPage.jsx'));
const AdminOffers = lazy(() => import('./pages/admin/OffersPage.jsx'));

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
            <Route path="account" element={<Navigate to="/settings/account" replace />} />
            <Route path="library" element={guard(RequireAuth, ProfilePage)} />
            <Route path="following" element={guard(RequireAuth, FollowingPage)} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
            <Route path="u/:username" element={<UserProfilePage />} />
            <Route path="videos" element={<VideosHomePage />} />
            <Route path="videos/browse" element={<VideosBrowsePage />} />
            <Route path="videos/:id" element={<VideoPage />} />
            <Route path="studio/welcome" element={guard(RequireAuth, StudioWelcomePage)} />
            <Route path="plus" element={<PlusPage />} />
            <Route path="payments/return" element={guard(RequireAuth, PaymentReturnPage)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="login" element={guard(GuestOnly, LoginPage)} />
            <Route path="register" element={guard(GuestOnly, RegisterPage)} />
            <Route path="check-email" element={<CheckEmailPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="confirm-email" element={<ConfirmEmailPage />} />
          </Route>

          <Route path="studio" element={guard(RequireCreator, StudioLayout)}>
            <Route index element={<StudioOverviewPage />} />
            <Route path="music" element={<StudioMusicPage />} />
            <Route path="music/new" element={<StudioSongRoute />} />
            <Route path="music/:id" element={<StudioSongRoute />} />
            <Route path="lyrics" element={<StudioLyricsPage />} />
            <Route path="lyrics/:songId" element={<LyricsRoute scope="studio" />} />
            <Route path="albums" element={<StudioAlbumsPage />} />
            <Route path="videos" element={<StudioVideosPage />} />
            <Route path="videos/new" element={<VideoRoute scope="studio" />} />
            <Route path="videos/:id" element={<VideoRoute scope="studio" />} />
            <Route path="playlists" element={<PlaylistsPage />} />
            <Route path="analytics" element={<StudioAnalyticsPage />} />
            <Route path="followers" element={<StudioFollowersPage />} />
            <Route path="artists" element={<StudioArtistsPage />} />
            <Route path="profile" element={<StudioProfilePage />} />
            <Route path="settings" element={<StudioSettingsPage />} />
            <Route path="submit/:songId" element={<StudioSubmitPage />} />
            <Route path="payments" element={<StudioPaymentsPage />} />
          </Route>

          <Route path="admin" element={guard(RequireAdmin, AdminLayout)}>
            <Route index element={<AdminDashboard />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="lyrics" element={<AdminLyrics />} />
            <Route path="lyrics/:songId" element={<LyricsRoute scope="admin" />} />
            <Route path="videos" element={<AdminVideos />} />
            <Route path="videos/new" element={<VideoRoute scope="admin" />} />
            <Route path="videos/:id" element={<VideoRoute scope="admin" />} />
            <Route path="subtitles" element={<AdminSubtitles />} />
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
            <Route path="monetization" element={<AdminMonetization />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="plus-members" element={<AdminPlusMembers />} />
            <Route path="submissions" element={<AdminSubmissions />} />
            <Route path="offers" element={<AdminOffers />} />
          </Route>
        </Routes>
      </MaintenanceGate>
    </>
  );
}
