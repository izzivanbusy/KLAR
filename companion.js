/**
 * Klar — Max Companion Widget
 * Floating chat bubble on every page.
 */

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  const messages = [];
  let isOpen = false;
  let isStreaming = false;

  // ── Inject styles ─────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #max-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #C9521A;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(201,82,26,.38);
      z-index: 9998;
      transition: transform 160ms ease, box-shadow 160ms ease;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #max-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(201,82,26,.45);
    }
    #max-btn svg { width:24px; height:24px; }

    #max-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      background: #1A7A4A;
      border-radius: 50%;
      border: 2px solid #F8F7F4;
      display: none;
    }

    #max-panel {
      position: fixed;
      bottom: 96px;
      right: 28px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 12px 48px rgba(26,22,20,.15);
      display: flex;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
      transform: scale(0.92) translateY(12px);
      opacity: 0;
      pointer-events: none;
      transition: transform 200ms ease, opacity 200ms ease;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #max-panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    #max-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #E4E0DA;
      background: #F8F7F4;
    }
    #max-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #C9521A;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 15px;
      flex-shrink: 0;
    }
    #max-header-info { flex: 1; }
    #max-header-name { font-weight: 700; font-size: 15px; color: #1A1614; line-height: 1.2; }
    #max-header-status { font-size: 12px; color: #1A7A4A; font-weight: 500; }
    #max-close {
      width: 30px; height: 30px;
      border-radius: 50%;
      background: none;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #6D6460;
      transition: background 140ms;
    }
    #max-close:hover { background: #ECEAE5; }
    #max-fullpage {
      width: 30px; height: 30px;
      border-radius: 50%;
      background: none;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #6D6460;
      transition: background 140ms;
      text-decoration: none;
    }
    #max-fullpage:hover { background: #ECEAE5; }

    #max-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }
    #max-messages::-webkit-scrollbar { width: 4px; }
    #max-messages::-webkit-scrollbar-thumb { background: #CBC7C0; border-radius: 4px; }

    .max-msg {
      display: flex;
      gap: 10px;
      align-items: flex-end;
    }
    .max-msg.user { flex-direction: row-reverse; }

    .max-msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #C9521A;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 11px;
      flex-shrink: 0;
    }
    .max-msg.user .max-msg-avatar { background: #ECEAE5; color: #1A1614; }

    .max-msg-bubble {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.55;
      color: #1A1614;
    }
    .max-msg.assistant .max-msg-bubble {
      background: #F2F0EC;
      border-bottom-left-radius: 4px;
    }
    .max-msg.user .max-msg-bubble {
      background: #C9521A;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .max-msg-bubble p { margin: 0 0 8px; }
    .max-msg-bubble p:last-child { margin-bottom: 0; }
    .max-msg-bubble strong { font-weight: 600; }
    .max-msg-bubble em { font-style: italic; }
    .max-msg-bubble code {
      background: rgba(0,0,0,.08);
      padding: 1px 5px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }
    .max-msg.user .max-msg-bubble code {
      background: rgba(255,255,255,.2);
    }

    .max-typing { display: flex; gap: 5px; padding: 10px 14px; }
    .max-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #9E9894;
      animation: maxBounce 1.2s ease-in-out infinite;
    }
    .max-typing span:nth-child(2) { animation-delay: .2s; }
    .max-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes maxBounce {
      0%,60%,100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    #max-input-row {
      display: flex;
      gap: 10px;
      padding: 14px 16px;
      border-top: 1px solid #E4E0DA;
      background: #FFFFFF;
    }
    #max-input {
      flex: 1;
      border: 1.5px solid #E4E0DA;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      font-family: 'Inter', system-ui, sans-serif;
      color: #1A1614;
      background: #F8F7F4;
      resize: none;
      outline: none;
      transition: border-color 140ms;
      line-height: 1.5;
      max-height: 100px;
      overflow-y: auto;
    }
    #max-input:focus { border-color: #C9521A; background: #fff; }
    #max-input::placeholder { color: #9E9894; }
    #max-send {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: #C9521A;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      align-self: flex-end;
      transition: background 140ms, transform 120ms;
    }
    #max-send:hover { background: #AE4515; }
    #max-send:active { transform: scale(0.94); }
    #max-send:disabled { background: #CBC7C0; cursor: not-allowed; transform: none; }
    #max-send svg { width: 18px; height: 18px; }
  `;
  document.head.appendChild(style);

  // ── Build DOM ─────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'max-btn';
  btn.title = 'Chat with Max';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span id="max-badge"></span>
  `;

  const panel = document.createElement('div');
  panel.id = 'max-panel';
  panel.innerHTML = `
    <div id="max-header">
      <div id="max-avatar">M</div>
      <div id="max-header-info">
        <div id="max-header-name">Max</div>
        <div id="max-header-status">Online — ask me anything</div>
      </div>
      <a id="max-fullpage" href="/chat.html" title="Open full chat" target="_blank">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </a>
      <button id="max-close" title="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div id="max-messages"></div>
    <div id="max-input-row">
      <textarea id="max-input" placeholder="Frag mich irgendwas..." rows="1"></textarea>
      <button id="max-send" title="Send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // ── References ────────────────────────────────────────────
  const msgContainer = document.getElementById('max-messages');
  const input        = document.getElementById('max-input');
  const sendBtn      = document.getElementById('max-send');
  const closeBtn     = document.getElementById('max-close');

  // ── Greeting ──────────────────────────────────────────────
  const greetings = [
    'Hallo! Ich bin Max — dein Klar-Begleiter. Deutsch-Fragen, Grammatik, Kultur, oder einfach quatschen — ich bin dabei. Was liegt an?',
    'Hey! Max hier. Egal ob Konjunktiv II, ein frustrierter "WHY IS GERMAN LIKE THIS"-Moment oder eine einfache Vokabelfrage — frag los.',
    'Hi! Ich bin Max. Dein Companion hier bei Klar. Was beschäftigt dich heute?'
  ];
  addMessage('assistant', greetings[Math.floor(Math.random() * greetings.length)]);

  // ── Toggle ────────────────────────────────────────────────
  function open() {
    isOpen = true;
    panel.classList.add('open');
    document.getElementById('max-badge').style.display = 'none';
    setTimeout(() => input.focus(), 220);
    scrollToBottom();
  }
  function close() {
    isOpen = false;
    panel.classList.remove('open');
  }

  btn.addEventListener('click', () => isOpen ? close() : open());
  closeBtn.addEventListener('click', close);

  // ── Message rendering ─────────────────────────────────────
  function addMessage(role, text) {
    messages.push({ role, content: text });

    const wrap = document.createElement('div');
    wrap.className = `max-msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'max-msg-avatar';
    avatar.textContent = role === 'assistant' ? 'M' : 'Du';

    const bubble = document.createElement('div');
    bubble.className = 'max-msg-bubble';
    bubble.innerHTML = renderMarkdown(text);

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgContainer.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  function addTypingIndicator() {
    const wrap = document.createElement('div');
    wrap.className = 'max-msg assistant';
    wrap.id = 'max-typing';

    const avatar = document.createElement('div');
    avatar.className = 'max-msg-avatar';
    avatar.textContent = 'M';

    const bubble = document.createElement('div');
    bubble.className = 'max-msg-bubble max-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgContainer.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function removeTypingIndicator() {
    const t = document.getElementById('max-typing');
    if (t) t.remove();
  }

  function scrollToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  // Simple markdown: bold, italic, code, line breaks
  function renderMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // ── Send ──────────────────────────────────────────────────
  async function send() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    input.value = '';
    input.style.height = 'auto';
    addMessage('user', text);

    isStreaming = true;
    sendBtn.disabled = true;

    const typing = addTypingIndicator();

    // Build message history for API (last 30, exclude greeting from history)
    const apiMessages = messages.slice(-30).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let replyText = '';
      let bubble = null;

      removeTypingIndicator();

      // Pre-create the reply bubble
      const wrapEl = document.createElement('div');
      wrapEl.className = 'max-msg assistant';
      const avatarEl = document.createElement('div');
      avatarEl.className = 'max-msg-avatar';
      avatarEl.textContent = 'M';
      bubble = document.createElement('div');
      bubble.className = 'max-msg-bubble';
      bubble.innerHTML = '<span class="max-cursor">▊</span>';
      wrapEl.appendChild(avatarEl);
      wrapEl.appendChild(bubble);
      msgContainer.appendChild(wrapEl);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const { text: chunk, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (chunk) {
              replyText += chunk;
              bubble.innerHTML = renderMarkdown(replyText) + '<span class="max-cursor" style="opacity:.6">▊</span>';
              scrollToBottom();
            }
          } catch (e) { /* skip malformed */ }
        }
      }

      bubble.innerHTML = renderMarkdown(replyText);
      // Store assistant reply in history
      messages.push({ role: 'assistant', content: replyText });

    } catch (err) {
      removeTypingIndicator();
      addMessage('assistant', 'Ups, da ist was schiefgelaufen. Versuch es nochmal!');
      console.error('[Max]', err);
    }

    isStreaming = false;
    sendBtn.disabled = false;
    input.focus();
    scrollToBottom();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  // Badge when closed and message arrives (future: notification)
  // For now just show the button
})();
