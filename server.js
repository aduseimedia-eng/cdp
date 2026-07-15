const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 8080);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, done) => done(null, file.mimetype.startsWith('image/')) });
const DEFAULT_CONFIG = {
  eyebrow: 'Institute of Directors-Ghana presents', title: 'Continuous Development Program', edition: '2026.',
  description: 'Register for the upcoming Continuous Development Program hosted by the Institute of Directors-Ghana. Complete your details and confirm payment to secure your place.',
  date: 'See official poster', time: 'See official poster', venue: 'IoD-Ghana', fee: '—', paymentAmount: '—',
  momoNetwork: 'See official poster', momoNumber: 'Use number on poster', momoAccountName: 'INSTITUTE OF DIRECTORS-GHANA',
  bankAccounts: [{ id: 'bank-1', bankName: 'See official poster', branch: '', accountName: 'INSTITUTE OF DIRECTORS-GHANA', accountNumber: 'Use account on poster' }],
  registrationOpen: true, showPoster: true, showEventDetails: true, showFee: true, posterDataUrl: ''
};

app.use(express.json({ limit: '3mb' }));
function adminOnly(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  try { req.admin = jwt.verify(token, process.env.JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Sign in required.' }); }
}
function clean(value, max = 255) { return String(value || '').trim().slice(0, max); }
function reference() { return `IOD-CDP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(`${salt}:${key.toString('hex')}`))); }
function passwordMatches(password, stored) { const [salt, hash] = String(stored || '').split(':'); return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => { if (error) return reject(error); resolve(Boolean(hash) && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key)); })); }

async function initialise() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_config (id BOOLEAN PRIMARY KEY DEFAULT TRUE, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS registrations (
      id BIGSERIAL PRIMARY KEY, reference TEXT UNIQUE NOT NULL, title TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      email TEXT NOT NULL, organization TEXT NOT NULL, whatsapp TEXT NOT NULL, role TEXT NOT NULL, network TEXT NOT NULL,
      bank_account_id TEXT, payment_provider TEXT, payment_phone TEXT, transaction_id TEXT NOT NULL, receipt_name TEXT,
      receipt_mime TEXT, receipt_data BYTEA, status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Verified')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_credentials (id BOOLEAN PRIMARY KEY DEFAULT TRUE, password_hash TEXT NOT NULL);`);
  await pool.query('INSERT INTO app_config (id, value) VALUES (TRUE, $1) ON CONFLICT (id) DO NOTHING', [DEFAULT_CONFIG]);
  const existingAdmin = await pool.query('SELECT 1 FROM admin_credentials WHERE id = TRUE');
  if (!existingAdmin.rowCount && process.env.ADMIN_PASSWORD) await pool.query('INSERT INTO admin_credentials (id, password_hash) VALUES (TRUE, $1)', [await hashPassword(process.env.ADMIN_PASSWORD)]);
}
async function config() { return (await pool.query('SELECT value FROM app_config WHERE id = TRUE')).rows[0].value; }

app.get('/api/config', async (_req, res, next) => { try { res.json(await config()); } catch (e) { next(e); } });
app.put('/api/config', adminOnly, async (req, res, next) => { try {
  const value = { ...DEFAULT_CONFIG, ...req.body, bankAccounts: Array.isArray(req.body.bankAccounts) ? req.body.bankAccounts.slice(0, 10) : DEFAULT_CONFIG.bankAccounts };
  await pool.query('UPDATE app_config SET value = $1, updated_at = NOW() WHERE id = TRUE', [value]); res.json(value);
} catch (e) { next(e); } });
app.post('/api/registrations', upload.single('receipt'), async (req, res, next) => { try {
  const current = await config(); if (!current.registrationOpen) return res.status(403).json({ error: 'Registration is currently closed.' });
  const required = ['firstName', 'lastName', 'email', 'organization', 'whatsapp', 'role', 'network'];
  if (required.some((key) => !clean(req.body[key]))) return res.status(400).json({ error: 'Please complete all required fields.' });
  if (!/^\S+@\S+\.\S+$/.test(clean(req.body.email))) return res.status(400).json({ error: 'Enter a valid email address.' });
  const bank = current.bankAccounts.find((item) => item.id === req.body.bankAccount);
  const paymentProvider = req.body.network === 'Bank transfer' ? (bank?.bankName || 'Bank transfer') : current.momoNetwork;
  const suppliedReference = clean(req.body.reference, 40);
  const values = [/^IOD-CDP-[A-Z0-9-]+$/.test(suppliedReference) ? suppliedReference : reference(), clean(req.body.title, 30), clean(req.body.firstName), clean(req.body.lastName), clean(req.body.email), clean(req.body.organization), clean(req.body.whatsapp, 15), clean(req.body.role), clean(req.body.network), clean(req.body.bankAccount, 100), clean(paymentProvider), clean(req.body.paymentPhone, 30), clean(req.body.transactionId, 100), req.file?.originalname?.slice(0, 255) || null, req.file?.mimetype || null, req.file?.buffer || null];
  const result = await pool.query(`INSERT INTO registrations (reference,title,first_name,last_name,email,organization,whatsapp,role,network,bank_account_id,payment_provider,payment_phone,transaction_id,receipt_name,receipt_mime,receipt_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING reference, submitted_at`, values);
  res.status(201).json({ reference: result.rows[0].reference, submittedAt: result.rows[0].submitted_at });
} catch (e) { next(e); } });
app.post('/api/admin/login', async (req, res, next) => { try {
  if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'Admin access is not configured.' });
  const stored = await pool.query('SELECT password_hash FROM admin_credentials WHERE id = TRUE');
  if (!stored.rowCount) return res.status(503).json({ error: 'Admin access is not configured.' });
  const password = clean(req.body.password, 512);
  let validPassword = await passwordMatches(password, stored.rows[0].password_hash);
  if (!validPassword && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    await pool.query('UPDATE admin_credentials SET password_hash = $1 WHERE id = TRUE', [await hashPassword(password)]);
    validPassword = true;
  }
  if (!validPassword) return res.status(401).json({ error: 'Incorrect password.' });
  res.json({ token: jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' }) });
} catch (e) { next(e); } });
app.put('/api/admin/password', adminOnly, async (req, res, next) => { try {
  const current = clean(req.body.currentPassword, 512); const nextPassword = clean(req.body.newPassword, 512);
  if (nextPassword.length < 8) return res.status(400).json({ error: 'Use at least 8 characters.' });
  const stored = await pool.query('SELECT password_hash FROM admin_credentials WHERE id = TRUE');
  if (!stored.rowCount || !await passwordMatches(current, stored.rows[0].password_hash)) return res.status(401).json({ error: 'Current password is incorrect.' });
  await pool.query('UPDATE admin_credentials SET password_hash = $1 WHERE id = TRUE', [await hashPassword(nextPassword)]); res.status(204).end();
} catch (e) { next(e); } });
app.get('/api/admin/registrations', adminOnly, async (_req, res, next) => { try {
  const { rows } = await pool.query(`SELECT reference, title, first_name AS "firstName", last_name AS "lastName", email, organization, whatsapp, role, network, bank_account_id AS "bankAccountId", payment_provider AS "paymentProvider", payment_phone AS "paymentPhone", transaction_id AS "transactionId", receipt_name AS "receiptName", status, submitted_at AS "submittedAt" FROM registrations ORDER BY submitted_at DESC`); res.json(rows);
} catch (e) { next(e); } });
app.patch('/api/admin/registrations/:reference', adminOnly, async (req, res, next) => { try {
  const status = req.body.status; if (!['Pending', 'Verified'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const result = await pool.query('UPDATE registrations SET status = $1 WHERE reference = $2', [status, req.params.reference]);
  if (!result.rowCount) return res.status(404).json({ error: 'Registration not found.' }); res.status(204).end();
} catch (e) { next(e); } });
app.delete('/api/admin/registrations/:reference', adminOnly, async (req, res, next) => { try { await pool.query('DELETE FROM registrations WHERE reference = $1', [req.params.reference]); res.status(204).end(); } catch (e) { next(e); } });
app.get('/api/admin/registrations/:reference/receipt', adminOnly, async (req, res, next) => { try {
  const { rows } = await pool.query('SELECT receipt_name, receipt_mime, receipt_data FROM registrations WHERE reference = $1', [req.params.reference]);
  if (!rows[0]?.receipt_data) return res.sendStatus(404); res.type(rows[0].receipt_mime).send(rows[0].receipt_data);
} catch (e) { next(e); } });
app.use(express.static(__dirname, { index: 'index.html', dotfiles: 'deny' }));
app.use((error, _req, res, _next) => { console.error(error); res.status(error instanceof multer.MulterError ? 400 : 500).json({ error: error instanceof multer.MulterError ? 'Receipt must be an image smaller than 5MB.' : 'Something went wrong. Please try again.' }); });
initialise().then(() => app.listen(port, '0.0.0.0', () => console.log(`Listening on ${port}`))).catch((error) => { console.error('Database setup failed', error); process.exit(1); });
