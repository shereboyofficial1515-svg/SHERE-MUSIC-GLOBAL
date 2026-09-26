import { getSettings } from '../services/settings.service.js';

// Routes that must keep working during maintenance so admins can sign in and turn it off.
const ALLOWED = [/^\/health$/, /^\/settings$/, /^\/auth\/(login|logout|me)$/, /^\/admin(\/|$)/];

export async function maintenanceGate(req, res, next) {
  if (req.user?.role === 'admin' || ALLOWED.some((re) => re.test(req.path))) return next();
  const settings = await getSettings();
  if (!settings.maintenance_mode) return next();
  res.status(503).json({
    error: {
      message: settings.maintenance_message || `${settings.site_name} is undergoing maintenance. Please check back soon.`,
      code: 'MAINTENANCE',
    },
  });
}
