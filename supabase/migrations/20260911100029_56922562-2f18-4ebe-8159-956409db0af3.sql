CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 2 AND 40),
  full_name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  location_name text NOT NULL DEFAULT '',
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  tags text[] NOT NULL DEFAULT '{}',
  services text[] NOT NULL DEFAULT '{}',
  starting_price numeric(10,2) CHECK (starting_price IS NULL OR starting_price >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  is_available boolean NOT NULL DEFAULT true,
  is_listed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view listed profiles" ON public.profiles FOR SELECT TO anon USING (is_listed = true);
CREATE POLICY "Authenticated can view listed profiles or self" ON public.profiles FOR SELECT TO authenticated USING (is_listed = true OR auth.uid() = id);
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT ALL ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view portfolio for listed profiles" ON public.portfolio_items FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_listed = true));
CREATE POLICY "Authenticated can view public portfolio or self" ON public.portfolio_items FOR SELECT TO authenticated USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_listed = true));
CREATE POLICY "Users can create own portfolio" ON public.portfolio_items FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can update own portfolio" ON public.portfolio_items FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can delete own portfolio" ON public.portfolio_items FOR DELETE TO authenticated USING (profile_id = auth.uid());
CREATE TRIGGER portfolio_items_set_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    'freelancer-' || left(replace(NEW.id::text, '-', ''), 8),
    coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

CREATE INDEX profiles_location_idx ON public.profiles (latitude, longitude) WHERE is_listed = true;
CREATE INDEX profiles_tags_idx ON public.profiles USING gin (tags);
CREATE INDEX portfolio_items_profile_idx ON public.portfolio_items (profile_id, sort_order);
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;