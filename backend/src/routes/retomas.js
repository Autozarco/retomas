const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware, requireGroup } = require('../middleware/auth');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('retomas')
      .select(`
        *,
        vendedor:profiles!vendedor_id(username, full_name),
        carrocaria:retoma_carrocaria(*),
        mecanica:retoma_mecanica(*),
        damage_map:retoma_damage_map(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('retomas')
      .select(`
        *,
        vendedor:profiles!vendedor_id(username, full_name),
        carrocaria:retoma_carrocaria(*),
        mecanica:retoma_mecanica(*),
        damage_map:retoma_damage_map(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Retoma not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, requireGroup('comercial'), async (req, res) => {
  const {
    marca_modelo, quilometragem, matricula, data_matricula, combustivel, cilindrada, reserva_propriedade,
    cliente_nome, cliente_telefone, cliente_email, cliente_nif, interessado_em,
    valor_retoma, observacoes, status,
    carrocaria, mecanica, damage_points
  } = req.body;

  try {
    const { data: retoma, error: retomaError } = await supabase
      .from('retomas')
      .insert({
        marca_modelo, quilometragem, matricula, data_matricula, combustivel, cilindrada, reserva_propriedade,
        cliente_nome, cliente_telefone, cliente_email, cliente_nif, interessado_em,
        vendedor_id: req.user.id,
        valor_retoma, observacoes, status: status || 'pendente'
      })
      .select()
      .single();

    if (retomaError) {
      return res.status(400).json({ error: retomaError.message });
    }

    if (carrocaria) {
      await supabase
        .from('retoma_carrocaria')
        .insert({ retoma_id: retoma.id, ...carrocaria });
    }

    if (mecanica) {
      await supabase
        .from('retoma_mecanica')
        .insert({ retoma_id: retoma.id, ...mecanica });
    }

    if (damage_points) {
      await supabase
        .from('retoma_damage_map')
        .insert({ retoma_id: retoma.id, damage_points });
    }

    res.json(retoma);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const { carrocaria, mecanica, damage_points, ...retomaUpdates } = updates;

    if (Object.keys(retomaUpdates).length > 0) {
      const { data, error } = await supabase
        .from('retomas')
        .update(retomaUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    if (carrocaria) {
      await supabase
        .from('retoma_carrocaria')
        .update(carrocaria)
        .eq('retoma_id', id);
    }

    if (mecanica) {
      await supabase
        .from('retoma_mecanica')
        .update(mecanica)
        .eq('retoma_id', id);
    }

    if (damage_points !== undefined) {
      await supabase
        .from('retoma_damage_map')
        .update({ damage_points })
        .eq('retoma_id', id);
    }

    const { data: updated } = await supabase
      .from('retomas')
      .select(`
        *,
        vendedor:profiles!vendedor_id(username, full_name),
        carrocaria:retoma_carrocaria(*),
        mecanica:retoma_mecanica(*),
        damage_map:retoma_damage_map(*)
      `)
      .eq('id', id)
      .single();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, requireGroup('comercial', 'gerencia'), async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('retomas')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Retoma deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/csv', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('retomas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const parser = new Parser();
    const csv = parser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment('retomas.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/pdf', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('retomas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=retomas.pdf');
    doc.pipe(res);

    doc.fontSize(18).text('AUTO ZARCO - Relatório de Retomas', { align: 'center' });
    doc.moveDown();

    data.forEach(r => {
      doc.fontSize(10).text(`ID: ${r.id}`);
      doc.text(`Cliente: ${r.cliente_nome} | Veículo: ${r.marca_modelo}`);
      doc.text(`Matrícula: ${r.matricula} | Valor: €${r.valor_retoma || 0}`);
      doc.text(`Status: ${r.status}`);
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
