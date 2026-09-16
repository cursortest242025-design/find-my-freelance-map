ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_address boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS github_repos text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.profile_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_reactions TO authenticated;
GRANT SELECT ON public.profile_reactions TO anon;
GRANT ALL ON public.profile_reactions TO service_role;
ALTER TABLE public.profile_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reactions on listed profiles" ON public.profile_reactions FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_reactions.profile_id AND p.is_listed = true));
CREATE POLICY "Users manage own reaction" ON public.profile_reactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.profile_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_comments TO authenticated;
GRANT SELECT ON public.profile_comments TO anon;
GRANT ALL ON public.profile_comments TO service_role;
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments on listed profiles" ON public.profile_comments FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_comments.profile_id AND p.is_listed = true));
CREATE POLICY "Users can comment" ON public.profile_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can edit own comment" ON public.profile_comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or profile owner can remove comment" ON public.profile_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR profile_id = auth.uid());
CREATE TRIGGER profile_comments_set_updated_at BEFORE UPDATE ON public.profile_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());