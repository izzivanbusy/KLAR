# Klar — Setup Guide

German A0 → A2 online course platform.

## What you need before starting

- A [Supabase](https://supabase.com) account (free)
- An [Anthropic](https://console.anthropic.com) API key
- [Node.js](https://nodejs.org) 18+ installed on your computer or server

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New project**, give it any name (e.g. `klar`)
3. Wait for it to provision (about 1 minute)
4. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run** (green button)

This creates all the tables, security rules, and the PDF storage bucket.

---

## Step 3 — Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Click **API Keys → Create Key**
3. Copy the key → `ANTHROPIC_API_KEY`

---

## Step 4 — Configure environment variables

In the `klar/` folder:

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_EMAIL=your-email@example.com    # the email you'll use to manage lessons
PORT=3000
APP_URL=http://localhost:3000
```

> **Important:** `ADMIN_EMAIL` must exactly match the email you'll use when creating your account on the platform. This gives you access to the admin panel at `/admin.html`.

---

## Step 5 — Install dependencies and start

```bash
cd klar
npm install
npm start
```

You should see:
```
🟢 Klar server running at http://localhost:3000
   Admin email: your-email@example.com
   Supabase:    ✓ configured
   Anthropic:   ✓ configured
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-restart:
```bash
npm run dev
```

---

## Step 6 — Create your admin account

1. Go to [http://localhost:3000/register.html](http://localhost:3000/register.html)
2. Register with **the same email** you set as `ADMIN_EMAIL`
3. After logging in, go to [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## Step 7 — Add your lessons

In the admin panel:

1. Click **Create Lesson**
2. Fill in: lesson number, level (A0/A1/A1.2/A2), title, description
3. Paste your YouTube URL
4. Click **Save as draft**
5. Go to **All Lessons**, find the lesson, click **Edit** to add PDFs and links
6. When ready, click **○ Draft** to toggle it to **● Published**

Students can only see published lessons.

### Adding materials to a lesson

After creating the lesson, click **Edit** then scroll to **Materials**:

- **PDF** — upload directly from your computer (stored in Supabase)
- **Link** — paste any external URL (e.g. dict.cc, a grammar site)
- **Note** — write a short text note shown in the lesson

### The AI tutor

The AI tutor in each lesson uses your **lesson description** as context. Write it clearly — it's what the AI knows about the lesson. Example:

> "In this lesson, students learn to greet people formally and informally in German. Key phrases: Hallo, Guten Morgen, Guten Tag, Auf Wiedersehen, Tschüss. Students also learn how to ask someone's name: Wie heißen Sie? / Wie heißt du?"

---

## Deploying to the web

### Railway (easiest)

1. Push this folder to a GitHub repository
2. Go to [railway.app](https://railway.app), connect your GitHub repo
3. Add all your environment variables in the Railway dashboard
4. Railway detects Node.js automatically and deploys

### Render

1. Push to GitHub
2. New Web Service on [render.com](https://render.com)
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables

### Heroku

```bash
heroku create klar-app
heroku config:set SUPABASE_URL=... SUPABASE_ANON_KEY=... # etc.
git push heroku main
```

---

## File structure

```
klar/
├── public/
│   ├── index.html        ← Landing page
│   ├── login.html        ← Login
│   ├── register.html     ← Registration
│   ├── dashboard.html    ← Student dashboard
│   ├── course.html       ← All lessons overview
│   ├── lesson.html       ← Individual lesson + AI chat
│   ├── admin.html        ← Admin panel (manage lessons)
│   ├── css/
│   │   └── klar.css      ← Shared design system
│   └── js/
│       └── klar.js       ← Shared utilities (Supabase, auth, toast, etc.)
├── supabase/
│   └── schema.sql        ← Database schema — run once in Supabase SQL editor
├── server.js             ← Express server (static files + AI chat proxy)
├── package.json
├── .env.example          ← Copy to .env and fill in your keys
└── README.md             ← This file
```

---

## Common issues

**"Access denied" on admin page**
Your logged-in email doesn't match `ADMIN_EMAIL` in `.env`. Make sure they're identical.

**AI chat not working**
Check that `ANTHROPIC_API_KEY` is set correctly in `.env` and the server restarted.

**Videos not showing**
The YouTube URL must be a standard format: `https://youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`.

**PDF upload failing**
Check that `SUPABASE_SERVICE_ROLE_KEY` is set. Also verify the storage bucket was created by running the full `schema.sql`.

**"No lessons published"**
Lessons must be toggled to **Published** in the admin panel before students can see them.
