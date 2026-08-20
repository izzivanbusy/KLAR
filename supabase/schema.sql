-- ============================================================
-- Klar — Supabase Database Schema
-- Run this in your Supabase project: SQL Editor → New Query → Run
-- ============================================================

-- ── USER PROFILES ─────────────────────────────────────────────
-- Extends Supabase's built-in auth.users table
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  age_group     TEXT,          -- e.g. '18-24', '25-34', etc.
  mother_language TEXT,        -- e.g. 'English', 'Russian', etc.
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ── LESSONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_number  INTEGER NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  level          TEXT NOT NULL CHECK (level IN ('A0','A1','A1.2','A2')),
  description    TEXT,                 -- shown on lesson page, used in AI system prompt
  youtube_url    TEXT,                 -- full YouTube URL, e.g. https://youtube.com/watch?v=...
  duration_min   INTEGER DEFAULT 45,   -- estimated lesson duration in minutes
  is_published   BOOLEAN DEFAULT FALSE,
  order_index    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── LESSON MATERIALS (PDFs, links, notes) ─────────────────────
CREATE TABLE IF NOT EXISTS lesson_materials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('pdf','link','note')),
  title        TEXT NOT NULL,
  url          TEXT,             -- Supabase storage URL for PDFs, external URL for links
  description  TEXT,             -- optional description shown under the material
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── USER PROGRESS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- ── CHAT MESSAGES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id   UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast chat history lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_lesson
  ON chat_messages(user_id, lesson_id, created_at);

-- Index for fast progress lookups
CREATE INDEX IF NOT EXISTS idx_user_progress_user
  ON user_progress(user_id, lesson_id);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;

-- user_profiles: users can only read/update their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- lessons: everyone can read published lessons; only service role can write
CREATE POLICY "Anyone can read published lessons"
  ON lessons FOR SELECT
  USING (is_published = TRUE);

-- lesson_materials: anyone authenticated can read
CREATE POLICY "Authenticated users can read materials"
  ON lesson_materials FOR SELECT
  TO authenticated
  USING (TRUE);

-- user_progress: users manage only their own rows
CREATE POLICY "Users manage own progress"
  ON user_progress FOR ALL
  USING (auth.uid() = user_id);

-- chat_messages: users manage only their own messages
CREATE POLICY "Users manage own chat messages"
  ON chat_messages FOR ALL
  USING (auth.uid() = user_id);


-- ── STORAGE BUCKET FOR PDFs ───────────────────────────────────
-- Run this separately in Supabase → Storage → New Bucket
-- Or paste into SQL editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-materials', 'lesson-materials', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read materials
CREATE POLICY "Authenticated users can read lesson files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lesson-materials');

-- Allow uploads (admin uploads via service role — handled server-side)
CREATE POLICY "Service role can upload lesson files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'lesson-materials');

CREATE POLICY "Service role can delete lesson files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'lesson-materials');
