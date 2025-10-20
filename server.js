
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'database.db');
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE);

const JWT_SECRET = process.env.JWT_SECRET || 'devsecretkey';

function runAsync(sql, params=[]) {
  return new Promise((resolve,reject)=>{
    db.run(sql, params, function(err){
      if(err) reject(err); else resolve(this);
    });
  });
}
function allAsync(sql, params=[]) {
  return new Promise((resolve,reject)=>{
    db.all(sql, params, (err, rows)=> err?reject(err):resolve(rows));
  });
}
function getAsync(sql, params=[]) {
  return new Promise((resolve,reject)=>{
    db.get(sql, params, (err,row)=> err?reject(err):resolve(row));
  });
}

// init DB and default admin
async function init() {
  if (!dbExists) {
    await runAsync(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      twofa_secret TEXT
    )`);
    await runAsync(`CREATE TABLE retomas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT,
      cliente TEXT,
      telefone TEXT,
      marca_modelo TEXT,
      quilometragem INTEGER,
      matricula TEXT,
      valor NUMERIC,
      status TEXT DEFAULT 'pendente',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    const pw = await bcrypt.hash('admin123', 10);
    await runAsync(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, ['admin', pw, 'admin']);
    console.log('DB created and admin user added: admin / admin123');
  } else {
    console.log('DB exists, skipping init.');
  }
}
init().catch(err=>console.error(err));

// Auth
app.post('/api/login', async (req,res)=>{
  const { username, password, token2 } = req.body;
  try{
    const user = await getAsync('SELECT * FROM users WHERE username = ?', [username]);
    if(!user) return res.status(401).json({ error: 'Invalid' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({ error: 'Invalid' });
    // if 2FA enabled, verify token
    if(user.twofa_secret) {
      if(!token2) return res.status(403).json({ error: '2FA required' });
      const v = speakeasy.totp.verify({ secret: user.twofa_secret, encoding: 'base32', token: token2 });
      if(!v) return res.status(403).json({ error: 'Invalid 2FA token' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

function authMiddleware(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).send('No token');
  const token = h.split(' ')[1];
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  }catch(e){ return res.status(401).send('Invalid token'); }
}

// 2FA setup
app.post('/api/2fa/setup', authMiddleware, async (req,res)=>{
  try{
    const secret = speakeasy.generateSecret({ length: 20, name: `Retomas (${req.user.username})` });
    res.json({ base32: secret.base32, otpauth_url: secret.otpauth_url });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

app.post('/api/2fa/confirm', authMiddleware, async (req,res)=>{
  const { secret, token } = req.body;
  const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token });
  if(!valid) return res.status(400).json({ error: 'Invalid token' });
  await runAsync('UPDATE users SET twofa_secret = ? WHERE id = ?', [secret, req.user.id]);
  res.json({ ok: true });
});

// user management (admin)
app.get('/api/users', authMiddleware, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).send('Forbidden');
  const users = await allAsync('SELECT id, username, role FROM users');
  res.json(users);
});
app.post('/api/users', authMiddleware, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).send('Forbidden');
  const { username, password, role } = req.body;
  const pw = await bcrypt.hash(password, 10);
  await runAsync('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, pw, role||'vendedor']);
  res.json({ ok: true });
});

// retomas endpoints
app.get('/api/retomas', authMiddleware, async (req,res)=>{
  const rows = await allAsync('SELECT * FROM retomas ORDER BY created_at DESC');
  res.json(rows);
});
app.post('/api/retomas', authMiddleware, async (req,res)=>{
  const p = req.body;
  const r = await runAsync(`INSERT INTO retomas (vin, cliente, telefone, marca_modelo, quilometragem, matricula, valor, status) VALUES (?,?,?,?,?,?,?,?)`,
    [p.vin,p.cliente,p.telefone,p.marca_modelo,p.quilometragem,p.matricula,p.valor,p.status||'pendente']);
  res.json({ ok: true, id: r.lastID });
});

// export CSV
app.get('/api/retomas/export/csv', authMiddleware, async (req,res)=>{
  const rows = await allAsync('SELECT * FROM retomas ORDER BY created_at DESC');
  const parser = new (require('json2csv').Parser)();
  const csv = parser.parse(rows);
  res.header('Content-Type', 'text/csv');
  res.attachment('retomas.csv');
  res.send(csv);
});

// export PDF (simple table)
app.get('/api/retomas/export/pdf', authMiddleware, async (req,res)=>{
  const rows = await allAsync('SELECT * FROM retomas ORDER BY created_at DESC');
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename=retomas.pdf');
  doc.pipe(res);
  doc.fontSize(18).text('Retomas - Relatório', { align: 'center' });
  doc.moveDown();
  rows.forEach(r=>{
    doc.fontSize(12).text(`ID: ${r.id} | Cliente: ${r.cliente} | Veículo: ${r.marca_modelo} | Matricula: ${r.matricula} | Valor: ${r.valor}`);
    doc.moveDown(0.4);
  });
  doc.end();
});

// fallback to serve index.html for SPA routes
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log('Server running on port', port));
