# Supabase Setup Guide for SI Guru SDN 1 Dukuhwaluh

This application uses Supabase for Authentication, Database (PostgreSQL), and Storage.

## 1. Project Setup
- Go to [Supabase Console](https://app.supabase.com/) and create a new project.
- Name: `SI-Guru-SDN1-Dukuhwaluh`
- Region: `Asia Southeast (Singapore)` or closest to you.

## 2. Database Schema
Run the following SQL in the **SQL Editor** of your Supabase project:

```sql
-- Roles enumeration
CREATE TYPE user_role AS ENUM ('admin', 'guru');

-- Profiles table (linked to auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nip TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'guru',
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('Laki-laki', 'Perempuan')),
  subject TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Classes table
CREATE TABLE classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  wali_kelas_id UUID REFERENCES profiles(id),
  academic_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Teaching Schedule
CREATE TABLE teaching_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guru_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  day TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lesson Materials (Teaching Journal)
CREATE TABLE lesson_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES teaching_schedules(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  chapter TEXT, -- Materi Pokok / Bab
  sub_chapter TEXT, -- Sub Bab / Topik Detail
  notes TEXT, -- Catatan Tambahan / Cadangan Objek JSON
  info TEXT, -- Informasi Jurnal Mengajar
  jumlah_murid INTEGER, -- Jumlah Murid Hadir
  tanggal_pembelajaran DATE DEFAULT CURRENT_DATE, -- Tanggal Pembelajaran
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(schedule_id, week_number)
);

-- Picket Schedule
CREATE TABLE picket_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guru_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  shift TEXT NOT NULL, -- e.g., 'Pagi', 'Siang'
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Announcements
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE picket_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies
-- Profiles: Users can read all, but only edit their own (admins can edit all)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Announcements: Viewable by all, editable by admin/kepala sekolah
CREATE POLICY "Announcements are viewable by everyone" ON announcements FOR SELECT USING (true);
```

## 3. Storage Setup
- Create a bucket named `avatars`.
- Set the policy to `Public` (or restricted to authenticated users for upload).

## 4. Environment Variables
Copy and paste the following into the **Secrets** panel in AI Studio or your local `.env`:
- `VITE_SUPABASE_URL`: Your Project URL from Settings > API.
- `VITE_SUPABASE_ANON_KEY`: Your Anon Key from Settings > API.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Service Role Key (Keep it secret!).
