import { next } from '@vercel/functions';

const prefix = '/artrade-money';
const cookieName = 'agentanium_artrade_session';
const maxAge = 12 * 60 * 60;
const enc = new TextEncoder();

const page = (message = '') => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Вход · Деньги</title><style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#151923;background:#f3f5f9}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px}.card{width:min(420px,100%);padding:36px;background:#fff;border:1px solid #e3e7ef;border-radius:22px;box-shadow:0 24px 80px rgba(25,34,56,.12)}.brand{display:flex;align-items:center;gap:10px;font-weight:750}.mark{width:34px;height:34px;border-radius:10px;background:#151923;color:#fff;display:grid;place-items:center}h1{font-size:28px;letter-spacing:-.035em;margin:34px 0 8px}p{margin:0 0 26px;color:#70798b;line-height:1.5}label{display:block;font-size:13px;font-weight:650;margin-bottom:8px}input{width:100%;height:50px;padding:0 14px;border:1.5px solid #e3e7ef;border-radius:12px;font-size:16px;outline:none}input:focus{border-color:#315bd6;box-shadow:0 0 0 4px rgba(49,91,214,.1)}button{width:100%;height:50px;margin-top:14px;border:0;border-radius:12px;background:#315bd6;color:#fff;font-weight:750;cursor:pointer}.error{min-height:20px;margin-top:12px;color:#c43d3d;font-size:13px}.note{margin:22px 0 0;font-size:12px;text-align:center;color:#9299a8}</style></head><body><main class="card"><div class="brand"><span class="mark">↗</span><span>Деньги · Розница</span></div><h1>Вход в финансовый кабинет</h1><p>Введите пароль, полученный от владельца отчёта.</p><form method="post" action="${prefix}/login"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">Войти</button><div class="error">${message}</div></form><div class="note">Защищённый доступ · AGENTANIUM</div></main></body></html>`;

function response(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'private, no-store', 'X-Frame-Options':'DENY', 'X-Content-Type-Options':'nosniff', ...extra } });
}
function redirect(request, path, extra = {}) {
  return new Response(null, { status:303, headers:{ Location:new URL(path, request.url).toString(), 'Cache-Control':'no-store', ...extra } });
}
async function bytes(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(value))));
}
async function equal(a, b) {
  const [x,y] = await Promise.all([bytes(a),bytes(b)]);
  let d=0; for(let i=0;i<x.length;i++) d|=x[i]^y[i];
  return d===0;
}
function b64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function sign(expires, secret) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(`artrade:${expires}`))));
}
function cookie(request) {
  const part=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));
  return part ? part.slice(cookieName.length+1) : '';
}
async function authenticated(request, secret) {
  if(!secret) return false;
  const [raw,supplied='']=cookie(request).split('.');
  const expires=Number(raw);
  if(!Number.isSafeInteger(expires)||expires<Math.floor(Date.now()/1000)) return false;
  return equal(supplied,await sign(expires,secret));
}
async function session(secret) {
  const expires=Math.floor(Date.now()/1000)+maxAge;
  return `${cookieName}=${expires}.${await sign(expires,secret)}; Max-Age=${maxAge}; Path=${prefix}; HttpOnly; Secure; SameSite=Strict`;
}

export default async function middleware(request) {
  const url=new URL(request.url);
  const password=process.env.ARTRADE_PASSWORD||'';
  const secret=process.env.ARTRADE_SESSION_SECRET||password;

  if(url.pathname===prefix+'/login') {
    if(request.method==='GET') return (await authenticated(request,secret)) ? redirect(request,prefix+'/') : response(page());
    if(request.method!=='POST') return response('Method not allowed',405,{Allow:'GET, POST'});
    if(!password||!secret) return response(page('Доступ временно не настроен.'),503);
    const form=await request.formData();
    if(!(await equal(form.get('password')||'',password))) return response(page('Неверный пароль.'),401);
    return redirect(request,prefix+'/',{'Set-Cookie':await session(secret)});
  }

  if(url.pathname===prefix+'/logout'&&request.method==='POST') {
    return redirect(request,prefix+'/login',{'Set-Cookie':`${cookieName}=; Max-Age=0; Path=${prefix}; HttpOnly; Secure; SameSite=Strict`});
  }

  if(!(await authenticated(request,secret))) return redirect(request,prefix+'/login');
  const res=next();
  res.headers.set('Cache-Control','private, no-store');
  res.headers.set('X-Frame-Options','DENY');
  return res;
}

export const config={matcher:['/artrade-money/:path*']};
