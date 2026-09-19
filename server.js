const express = require("express");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const required = [
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_BOT_TOKEN",
  "DISCORD_GUILD_ID",
  "DISCORD_VERIFIED_ROLE_ID",
  "SESSION_SECRET",
  "BASE_URL"
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000
  }
}));

function discordAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.BASE_URL + "/callback",
    scope: "identify",
    state
  });
  return "https://discord.com/oauth2/authorize?" + params.toString();
}

async function discordRequest(path, options = {}) {
  const response = await fetch("https://discord.com/api/v10" + path, {
    ...options,
    headers: {
      Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error("Discord API " + response.status);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/", (_req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/verify", (req, res) => {
  const state = cryptoRandom();
  req.session.oauthState = state;
  req.session.save((err) => {
    if (err) {
      console.error("Session save failed:", err);
      return res.status(500).send(errorPage("เริ่มการยืนยันไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง"));
    }
    res.redirect(discordAuthorizeUrl(state));
  });
});

app.get("/callback", async (req, res) => {
  try {
    if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) {
      console.error("OAuth state mismatch", {
        hasCode: Boolean(req.query.code),
        hasState: Boolean(req.query.state),
        hasSession: Boolean(req.session.oauthState)
      });
      return res.status(400).send(errorPage("ลิงก์ยืนยันไม่ถูกต้อง", "กรุณากลับไปเริ่มการยืนยันใหม่อีกครั้ง"));
    }
    delete req.session.oauthState;

    const tokenBody = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.query.code,
      redirect_uri: process.env.BASE_URL + "/callback"
    });

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) throw new Error("OAuth token exchange failed");

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: "Bearer " + token.access_token }
    });
    const user = await userRes.json();
    if (!userRes.ok) throw new Error("Could not read Discord user");

    try {
      await discordRequest(
        "/guilds/" + process.env.DISCORD_GUILD_ID + "/members/" + user.id
      );
    } catch (e) {
      if (e.status === 404) {
        return res.status(403).send(errorPage(
          "ยังไม่ได้อยู่ในเซิร์ฟเวอร์",
          "กรุณาเข้าร่วมเซิร์ฟเวอร์ Discord ก่อน แล้วกด Verify อีกครั้ง"
        ));
      }
      throw e;
    }

    await discordRequest(
      "/guilds/" + process.env.DISCORD_GUILD_ID +
      "/members/" + user.id +
      "/roles/" + process.env.DISCORD_VERIFIED_ROLE_ID,
      { method: "PUT" }
    );

    res.send(successPage(user));
  } catch (error) {
    console.error(error);
    res.status(500).send(errorPage("ยืนยันไม่สำเร็จ", "ระบบเกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"));
  }
});

function cryptoRandom() {
  return require("crypto").randomBytes(32).toString("hex");
}

function pageShell(title, body) {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} • Minho</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at 20% 10%,#5865f222,transparent 35%),linear-gradient(145deg,#090a0f,#11131b 55%,#08090d);color:#fff;display:grid;place-items:center;padding:24px}
.card{width:min(460px,100%);padding:34px;border:1px solid #ffffff16;border-radius:24px;background:#11131bd9;backdrop-filter:blur(18px);box-shadow:0 24px 80px #0008;text-align:center}
.logo{width:74px;height:74px;border-radius:22px;margin:0 auto 18px;background:linear-gradient(135deg,#5865f2,#7c3aed);display:grid;place-items:center;font-size:34px;font-weight:900;box-shadow:0 12px 35px #5865f244}
h1{margin:0 0 10px;font-size:27px}p{margin:0;color:#aeb4c4;line-height:1.65}.btn{display:block;margin-top:26px;padding:14px 18px;border-radius:13px;background:#5865f2;color:#fff;text-decoration:none;font-weight:800;transition:.2s}.btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
.badge{display:inline-flex;margin-top:18px;padding:7px 11px;border-radius:999px;background:#57f28718;color:#57f287;font-size:13px;font-weight:700}
.small{font-size:12px;color:#707789;margin-top:20px}
</style></head><body><main class="card">${body}</main></body></html>`;
}
function errorPage(title, message) {
  return pageShell(title, `<div class="logo">!</div><h1>${title}</h1><p>${message}</p><a class="btn" href="/">กลับหน้าหลัก</a>`);
}
function successPage(user) {
  const name = user.global_name || user.username || "Discord user";
  return pageShell("ยืนยันสำเร็จ", `<div class="logo">✓</div><h1>ยืนยันสำเร็จแล้ว</h1><p>บัญชี <strong>${escapeHtml(name)}</strong> ได้รับยศ <strong>Verified</strong> แล้ว</p><span class="badge">✓ Verified</span><div class="small">กลับไปที่ Discord ได้เลย</div>`);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

const missing = required.filter(k => !process.env[k]);
if (missing.length) console.warn("Missing environment variables:", missing.join(", "));

app.listen(PORT, "0.0.0.0", () => {
  console.log("Minho Discord Verify running on port " + PORT);
});