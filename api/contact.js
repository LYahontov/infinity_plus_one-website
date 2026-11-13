// Contact form endpoint for Vercel.
// Delivers each request to Telegram and/or email. Configure in Vercel → Settings → Environment Variables:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID       — Telegram delivery
//   RESEND_API_KEY, CONTACT_EMAIL_TO           — email delivery via resend.com (CONTACT_EMAIL_FROM optional)
// At least one channel must be configured.

const MAX = { name: 120, contact: 200, message: 4000 };
const clean = (v, n) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

async function toTelegram(text) {
  const { TELEGRAM_BOT_TOKEN: t, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!t || !chat) return null;
  const r = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return r.ok;
}

async function toEmail(subject, text, replyTo) {
  const { RESEND_API_KEY: k, CONTACT_EMAIL_TO: to } = process.env;
  if (!k || !to) return null;
  const from = process.env.CONTACT_EMAIL_FROM || 'Infinity Plus One <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: to.split(',').map((s) => s.trim()), subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  return r.ok;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const b = await readBody(req);
  if (clean(b.website, 200)) return res.status(200).json({ ok: true }); // honeypot: bots fill it, people don't see it

  const name = clean(b.name, MAX.name), contact = clean(b.contact, MAX.contact), message = clean(b.message, MAX.message);
  if (!name || !contact || !message) return res.status(400).json({ ok: false, error: 'missing' });

  const page = clean(b.page, 300);
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' });
  const tg = `<b>Новая заявка с сайта</b>\n\n<b>Имя:</b> ${esc(name)}\n<b>Контакт:</b> ${esc(contact)}\n\n${esc(message)}\n\n<i>${esc(when)} (Тбилиси)${page ? ' · ' + esc(page) : ''}</i>`;
  const mail = `Имя: ${name}\nКонтакт: ${contact}\n\n${message}\n\n${when} (Тбилиси)${page ? ' · ' + page : ''}`;
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;

  let results;
  try {
    results = await Promise.all([toTelegram(tg), toEmail(`Заявка с сайта: ${name}`, mail, replyTo)]);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'delivery' });
  }
  const configured = results.filter((r) => r !== null);
  if (!configured.length) return res.status(503).json({ ok: false, error: 'not_configured' });
  if (!configured.some(Boolean)) return res.status(502).json({ ok: false, error: 'delivery' });
  return res.status(200).json({ ok: true });
};
