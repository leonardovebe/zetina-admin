'use strict';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Supabase admin auth (usado por index.html) ────────────────────────────────
async function login(username, password) {
  const hash = await hashPassword(password);
  const { data, error } = await db
    .from('admins')
    .select('id, username, nombre')
    .eq('username', username.trim().toLowerCase())
    .eq('password_hash', hash)
    .maybeSingle();

  if (error) throw new Error('Error de conexión. Intenta de nuevo.');
  if (!data)  throw new Error('Usuario o contraseña incorrectos.');

  sessionStorage.setItem('zetina_admin', JSON.stringify({
    id: data.id, username: data.username, nombre: data.nombre
  }));
  return data;
}

function logout() {
  sessionStorage.removeItem('zetina_admin');
}

function getSession() {
  try {
    const s = sessionStorage.getItem('zetina_admin');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function isLoggedIn() {
  return getSession() !== null;
}

// ── PIN session auth (usado por dashboard.html) ───────────────────────────────
const _PIN_SESSION_KEY = 'zetina_pin_session';

function isPinSessionValid() {
  try {
    const s = JSON.parse(sessionStorage.getItem(_PIN_SESSION_KEY) || '{}');
    return !!(s.expiry && Date.now() < s.expiry);
  } catch { return false; }
}

function checkAuth() {
  if (!isPinSessionValid()) {
    location.href = 'pin.html';
    throw new Error('Sesión no válida');
  }
}

function pinLogout() {
  sessionStorage.removeItem(_PIN_SESSION_KEY);
  location.href = 'pin.html';
}
