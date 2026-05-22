'use strict';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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

function checkAuth() {
  if (!isLoggedIn()) {
    location.href = 'index.html';
    throw new Error('No autenticado');
  }
}
