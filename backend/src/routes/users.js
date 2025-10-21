const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, groups(name, display_name)')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  const { email, password, username, full_name, group_id, is_admin } = req.body;

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name
        }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (authData.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          full_name,
          group_id: group_id || null,
          is_admin: is_admin || false
        })
        .select()
        .single();

      if (profileError) {
        return res.status(400).json({ error: profileError.message });
      }

      res.json({ user: authData.user, profile });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, full_name, group_id, is_admin } = req.body;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username,
        full_name,
        group_id,
        is_admin
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    res.json({ message: 'User profile deleted successfully. Note: The auth account still exists and needs to be removed via Supabase Dashboard.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
