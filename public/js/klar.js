/**
 * klar.js — Shared utilities
 * Included on every app page via <script src="/js/klar.js">
 *
 * Requires: @supabase/supabase-js loaded via CDN before this file.
 * The Supabase URL and anon key are injected server-side into each page
 * as window.KLAR_CONFIG = { supabaseUrl, supabaseAnonKey }
 */

/* ── SUPABASE CLIENT ─────────────────────────────────────── */
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (!window.KLAR_CONFIG) throw new Error('KLAR_CONFIG not set. Did the server inject it?');
  _supabase = supabase.createClient(
    window.KLAR_CONFIG.supabaseUrl,
    window.KLAR_CONFIG.supabaseAnonKey
  );
  return _supabase;
}

/* ── AUTH HELPERS ────────────────────────────────────────── */

/** Returns the current session user or null */
async function getCurrentUser() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/** Redirects to /login.html if not authenticated */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

/** Redirects to /dashboard.html if already authenticated */
async function redirectIfAuth() {
  const user = await getCurrentUser();
  if (user) window.location.href = '/dashboard.html';
}

/** Sign out and redirect to landing */
async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
  window.location.href = '/';
}

/** Fetches the user's profile row */
async function getUserProfile(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

/* ── NAV HELPERS ─────────────────────────────────────────── */

/**
 * Renders the app nav into #app-nav-mount.
 * Call on every app page.
 */
async function renderAppNav(activePage = '') {
  const mount = document.getElementById('app-nav-mount');
  if (!mount) return;

  const user = await getCurrentUser();
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'You';

  const links = [
    { href: '/dashboard.html', label: 'Dashboard', id: 'dashboard' },
    { href: '/course.html',    label: 'Course',    id: 'course' },
  ];

  mount.innerHTML = `
    <nav class="app-nav" aria-label="Main navigation">
      <div class="app-nav__inner">
        <a href="/dashboard.html" class="app-nav__logo" aria-label="Klar home">
          Klar<span class="app-nav__logo-dot" aria-hidden="true"></span>
        </a>
        <div class="app-nav__links">
          ${links.map(l => `
            <a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">${l.label}</a>
          `).join('')}
        </div>
        <div class="app-nav__right">
          <span class="app-nav__user">${escHtml(displayName)}</span>
          <button class="btn btn--ghost btn--sm" onclick="signOut()">Log out</button>
        </div>
      </div>
    </nav>
  `;
}

/* ── TOAST NOTIFICATIONS ─────────────────────────────────── */

function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'default'|'success'|'error'} type
 * @param {number} duration ms
 */
function toast(message, type = 'default', duration = 3500) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast${type !== 'default' ? ` toast--${type}` : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 250ms ease forwards';
    setTimeout(() => el.remove(), 250);
  }, duration);
}

/* ── LOADING STATES ──────────────────────────────────────── */

/** Puts a button into loading state */
function btnLoading(btn, label = 'Loading…') {
  btn.disabled = true;
  btn._originalText = btn.textContent;
  btn.innerHTML = `<span class="spinner"></span> ${label}`;
}

/** Restores a button from loading state */
function btnDone(btn) {
  btn.disabled = false;
  btn.textContent = btn._originalText || 'Submit';
}

/* ── UTILS ───────────────────────────────────────────────── */

/** Safely escape HTML to prevent XSS */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Extract YouTube video ID from any YouTube URL format */
function extractYoutubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Format a date as "Aug 17, 2026" */
function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

/** Level → CSS badge class */
function levelBadgeClass(level) {
  const map = { 'A0':'badge-a0', 'A1':'badge-a1', 'A1.2':'badge-a12', 'A2':'badge-a2' };
  return map[level] || 'badge-a0';
}

/** Simple markdown-ish formatter for AI responses (bold, code, line breaks) */
function formatAIMessage(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,.07);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br>');
}

/* ── EXPOSE GLOBALS ──────────────────────────────────────── */
window.Klar = {
  getSupabase, getCurrentUser, requireAuth, redirectIfAuth, signOut,
  getUserProfile, renderAppNav, toast, btnLoading, btnDone,
  escHtml, extractYoutubeId, formatDate, levelBadgeClass, formatAIMessage,
};
