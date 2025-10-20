const supabase = require('../config/supabase');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, groups(name, display_name)')
      .eq('id', user.id)
      .maybeSingle();

    req.user = {
      id: user.id,
      email: user.email,
      profile: profile
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.profile || !req.user.profile.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireGroup(...allowedGroups) {
  return (req, res, next) => {
    if (!req.user || !req.user.profile) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { profile } = req.user;
    const userGroup = profile.groups?.name;

    if (profile.is_admin || allowedGroups.includes(userGroup)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { authMiddleware, requireAdmin, requireGroup };
