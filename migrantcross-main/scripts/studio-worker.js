/* Studio accounts and payments: a Cloudflare Worker (free plan is plenty).
   An account is just an email address, and Stripe is the only record of who has paid, so there is no database.

   Settings (Cloudflare → Workers → this worker → Settings → Variables and Secrets):
     STRIPE_KEY   secret  Stripe secret key: sk_test_… while testing (nothing is charged), sk_live_… to take real payments
     RESEND_KEY   secret  Resend API key, for the sign-in emails (resend.com, free for 3,000 emails a month)
     SECRET       secret  any long random string; signs the sign-in links and tokens (changing it signs everyone out)
     SITE         text    https://channelcrossings.world
     MAIL_FROM    text    Channel Crossings <studio@channelcrossings.world>  (the domain must be verified in Resend)
     PRICE_PENCE  text    199
     FREE_EMAILS  secret  optional: email addresses that always have Studio without paying, separated by commas (kept here, not in the
                          public code). They sign in with an emailed link, or with MASTER_KEY if it's set.
     MASTER_KEY   secret  optional: a long password. Signing in with one of the FREE_EMAILS then asks for it instead of sending an email.

   The page (studio.js) calls:
     POST /checkout {email}   → {url} a Stripe Checkout page for £1.99; or, if that email has already paid, emails a sign-in link → {paid, sent}
     POST /claim {session_id} → {token, email, studio} after paying, signs that device in (sessions under a day old only)
     POST /login {email}      → emails a sign-in link; for FREE_EMAILS when MASTER_KEY is set → {key:true}, and with {email, key} → {token, email, studio}
     POST /session {link}     → {token, email, studio} swaps the emailed link for a token kept on the device
     GET  /me  (Bearer token) → {email, studio}                                                                       */

const LINK_TTL = 30 * 60, TOKEN_TTL = 365 * 86400, CLAIM_TTL = 86400;
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
const validEmail = e => typeof e === "string" && e.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const norm = e => e.trim().toLowerCase();

const hmacKey = env => crypto.subtle.importKey("raw", enc.encode(env.SECRET), {name:"HMAC", hash:"SHA-256"}, false, ["sign", "verify"]);
async function sign(env, payload){ const body = b64u(enc.encode(JSON.stringify(payload))); return body + "." + b64u(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body))); }
async function verify(env, token, type){   // crypto.subtle.verify compares in constant time
  if(typeof token !== "string" || token.length > 2000) return null;
  const [body, sig, extra] = token.split(".");
  if(!body || !sig || extra !== undefined) return null;
  let p; try{
    if(!await crypto.subtle.verify("HMAC", await hmacKey(env), Uint8Array.from(unb64u(sig), c => c.charCodeAt(0)), enc.encode(body))) return null;
    p = JSON.parse(new TextDecoder().decode(Uint8Array.from(unb64u(body), c => c.charCodeAt(0))));
  }catch(e){ return null; }
  return p.t === type && p.x > Date.now() / 1000 ? p : null;
}

async function stripe(env, path, form){
  const r = await fetch("https://api.stripe.com/v1/" + path, {method:form ? "POST" : "GET",
    headers:{Authorization:"Bearer " + env.STRIPE_KEY, ...(form ? {"Content-Type":"application/x-www-form-urlencoded"} : {})}, body:form ? new URLSearchParams(form) : undefined});
  const j = await r.json(); if(!r.ok) throw new Error((j.error && j.error.message) || "Stripe error");
  return j;
}
// has this email paid for Studio? Every Stripe customer with the email, every completed Checkout of theirs
const isFree = (env, email) => (env.FREE_EMAILS || "").split(",").map(norm).filter(Boolean).includes(norm(email));
// is this the master password? Both sides are hashed first, so the comparison takes the same time whatever was typed
async function isMasterKey(env, key){
  if(typeof key !== "string" || !env.MASTER_KEY) return false;
  const [a, b] = await Promise.all([key, env.MASTER_KEY].map(k => crypto.subtle.digest("SHA-256", enc.encode(k)).then(h => new Uint8Array(h))));
  let d = 0; for(let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function hasPaid(env, email){
  if(isFree(env, email)) return true;
  const cs = await stripe(env, "customers?limit=10&email=" + encodeURIComponent(email));
  for(const c of cs.data){
    const ss = await stripe(env, "checkout/sessions?limit=100&status=complete&customer=" + c.id);
    if(ss.data.some(s => s.payment_status === "paid" && s.metadata && s.metadata.product === "studio")) return true;
  }
  return false;
}
async function customerFor(env, email){
  const cs = await stripe(env, "customers?limit=1&email=" + encodeURIComponent(email));
  return cs.data[0] ? cs.data[0].id : (await stripe(env, "customers", {email})).id;
}
async function session(env, email, studio){
  return {token:await sign(env, {t:"session", e:email, x:Math.floor(Date.now() / 1000) + TOKEN_TTL}), email, studio};
}
async function sendLink(env, email){
  const link = await sign(env, {t:"link", e:email, x:Math.floor(Date.now() / 1000) + LINK_TTL});
  const url = env.SITE + "/?signin=" + encodeURIComponent(link) + "#studio";
  const r = await fetch("https://api.resend.com/emails", {method:"POST", headers:{Authorization:"Bearer " + env.RESEND_KEY, "Content-Type":"application/json"},
    body:JSON.stringify({from:env.MAIL_FROM, to:email, subject:"Sign in to Channel Crossings Studio",
      text:"Open this link to sign in to Studio on this device:\n\n" + url + "\n\nIt works for 30 minutes. If you didn't ask for it, you can ignore this email.",
      html:'<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1c1c1e;max-width:480px">'
        + "<p>Tap the button to sign in to Studio on this device.</p>"
        + '<p><a href="' + url + '" style="display:inline-block;background:#007AFF;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">Sign in to Studio</a></p>'
        + '<p style="color:#6c6c70;font-size:14px">The link works for 30 minutes. If you didn\'t ask for it, you can ignore this email.</p></div>'})});
  if(!r.ok) throw new Error("The sign-in email couldn't be sent. Please try again.");
}

export default {
  async fetch(req, env){
    const cors = {"Access-Control-Allow-Origin":env.SITE, "Access-Control-Allow-Methods":"GET, POST, OPTIONS", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Vary":"Origin"};
    const json = (o, s) => new Response(JSON.stringify(o), {status:s || 200, headers:{...cors, "Content-Type":"application/json"}});
    if(req.method === "OPTIONS") return new Response(null, {headers:cors});
    const path = new URL(req.url).pathname;
    try{
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      const auth = await verify(env, (req.headers.get("Authorization") || "").replace(/^Bearer /, ""), "session");

      if(path === "/checkout" && req.method === "POST"){
        const email = auth ? auth.e : validEmail(body.email) ? norm(body.email) : null;
        if(!email) return json({error:"Please enter your email address."}, 400);
        if(await hasPaid(env, email)){
          if(auth) return json({paid:true, ...(await session(env, email, true))});
          await sendLink(env, email); return json({paid:true, sent:true});   // only the owner of the email can sign in to it
        }
        const s = await stripe(env, "checkout/sessions", {
          mode:"payment", customer:await customerFor(env, email), "metadata[product]":"studio", "payment_intent_data[metadata][product]":"studio",
          "line_items[0][quantity]":"1", "line_items[0][price_data][currency]":"gbp", "line_items[0][price_data][unit_amount]":env.PRICE_PENCE || "199",
          "line_items[0][price_data][product_data][name]":"Channel Crossings Studio",
          "line_items[0][price_data][product_data][description]":"Every chart, in more depth and in the forms you choose. The figures themselves stay free on GOV.UK.",
          success_url:env.SITE + "/?cs={CHECKOUT_SESSION_ID}#studio", cancel_url:env.SITE + "/#studio"});
        return json({url:s.url});
      }
      if(path === "/claim" && req.method === "POST"){
        if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(body.session_id || "")) return json({error:"That payment link isn't valid."}, 400);
        const s = await stripe(env, "checkout/sessions/" + body.session_id + "?expand[]=customer");
        if(s.payment_status !== "paid" || !s.metadata || s.metadata.product !== "studio") return json({error:"That payment hasn't gone through. If you were charged, sign in with your email."}, 402);
        if(Date.now() / 1000 - s.created > CLAIM_TTL) return json({error:"Please sign in with the email you paid with."}, 410);
        const email = norm((s.customer && s.customer.email) || (s.customer_details && s.customer_details.email) || "");
        return json(await session(env, email, true));
      }
      if(path === "/login" && req.method === "POST"){
        if(!validEmail(body.email)) return json({error:"Please enter your email address."}, 400);
        const email = norm(body.email);
        if(env.MASTER_KEY && isFree(env, email)){   // the master account signs in with its password, not an email
          if(!body.key) return json({key:true});
          if(!await isMasterKey(env, body.key)){ await new Promise(r => setTimeout(r, 1500)); return json({error:"That password isn’t right."}, 401); }
          return json(await session(env, email, true));
        }
        await sendLink(env, email); return json({sent:true});
      }
      if(path === "/session" && req.method === "POST"){
        const p = await verify(env, body.link, "link");
        if(!p) return json({error:"That sign-in link has expired. Please ask for a new one."}, 401);
        return json(await session(env, p.e, await hasPaid(env, p.e)));
      }
      if(path === "/me"){
        if(!auth) return json({error:"Please sign in again."}, 401);
        return json({email:auth.e, studio:await hasPaid(env, auth.e)});
      }
      return json({error:"Not found"}, 404);
    }catch(e){
      return json({error:"Something went wrong. Please try again."}, 500);
    }
  }
};
