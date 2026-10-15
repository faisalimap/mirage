const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // 31 chars, no look-alikes

// ---------- content filter (edit freely) ----------
const BLOCK_WORDS = new Set([
  "otp","kyc","cvv","upi","password","passcode","phishing","lottery","jackpot","giveaway","airdrop",
  "porn","porno","sex","nude","nudes","xxx","onlyfans","casino","betting",
  "sbi","hdfc","icici","axis","paytm","phonepe","gpay","npci","irctc","aadhaar","aadhar","uidai",
  "instagram","whatsapp","facebook","google","amazon","flipkart","microsoft","apple","netflix",
  "paypal","binance","coinbase","telegram","youtube","police","cbi","govt"
]);
const BLOCK_PHRASES = [
  "bank account","account blocked","account suspended","account will be","verify your","click here",
  "free recharge","sign in","log in","login","government of india","income tax","you have won",
  "arrest warrant","digital arrest","customer care"
];
const LEET = { "0":"o","1":"i","3":"e","4":"a","5":"s","@":"a","$":"s" };

function isBlocked(text) {
  const raw = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/https?:|www\.|[a-z0-9-]{2,}\s?\.\s?[a-z]{2,}\b|@\S+\.\S+/.test(raw)) return true; // links, domains, emails
  if (/(\d[\s\-().]*){7,}/.test(raw)) return true;                                    // phone-like numbers
  const t = raw.replace(/[01345@$]/g, c => LEET[c]).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (t.split(" ").some(w => BLOCK_WORDS.has(w))) return true;
  return BLOCK_PHRASES.some(p => t.includes(p));
}

// ---------- helpers ----------
function makeSlug() {
  const len = 6 + (crypto.getRandomValues(new Uint8Array(1))[0] % 2); // 6 or 7
  let out = "";
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && out.length < len) out += ALPHABET[b % 31]; // no modulo bias
    }
  }
  return out;
}

const esc = s => s.replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const clean = (s, max) =>
  String(s ?? "").replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, max);

function page(title, desc, url) {
  const t = esc(title), d = esc(desc);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="robots" content="noindex,nofollow">
<style>body{font-family:sans-serif;text-align:center;margin-top:15vh}</style>
</head><body><h1>404</h1><p>Not Found</p><hr><small>nginx</small></body></html>`;
}

const toB64 = str => {
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || new URL(req.url).pathname !== "/create") return json({ error: "Not found" }, 404);
    if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json({ error: "Forbidden" }, 403);

    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    if (!(await env.RATE.limit({ key: ip })).success) return json({ error: "Too many requests, wait a minute." }, 429);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

    const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(body.token || ""), remoteip: ip }),
    }).then(r => r.json()).catch(() => ({}));
    if (!ts.success) return json({ error: "Captcha failed, try again." }, 403);

    const title = clean(body.title, 70);
    const desc = clean(body.description, 200);
    if (!title) return json({ error: "Title required" }, 400);
    if (isBlocked(title + " " + desc)) return json({ error: "This text isn't allowed." }, 400);

    for (let i = 0; i < 6; i++) {
      const slug = makeSlug();
      const url = `https://${env.LINK_DOMAIN}/${slug}`;
      const res = await fetch(`https://api.github.com/repos/${env.GH_REPO}/contents/${slug}/index.html`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          "User-Agent": "mirage-worker",
          Accept: "application/vnd.github+json",
        },
        // No "sha" => 422 if file exists (atomic collision check)
        body: JSON.stringify({ message: `add ${slug}`, content: toB64(page(title, desc, url)) }),
      });
      if (res.status === 201) return json({ url });
      if (res.status !== 422 && res.status !== 409) return json({ error: "Upstream error" }, 502);
      // 409 = concurrent commit race, 422 = slug taken: retry with a new slug
    }
    return json({ error: "Busy, try again." }, 503);
  },
};
