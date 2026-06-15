/**
 * types/index.ts
 * Berkas definisi tipe data TypeScript (interfaces & types) untuk aplikasi.
 * Mendefinisikan tipe entitas database seperti profil guru, kelas, jadwal mengajar, dan pengumuman.
 */
export type UserRole = 'admin' | 'guru' | 'kepala_sekolah';

export interface Profile {
  id: string;
  nip: string | null;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  gender: 'Laki-laki' | 'Perempuan';
  subject: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  wali_kelas_id: string | null;
  academic_year: string;
  created_at: string;
  wali_kelas?: Profile;
}

export interface TeachingSchedule {
  id: string;
  guru_id: string;
  class_id: string;
  subject: string;
  day: string;
  start_time: string;
  end_time: string;
  guru?: Profile;
  class?: SchoolClass;
}

export interface PicketSchedule {
  id: string;
  guru_id: string;
  day: string;
  shift: string;
  location: string | null;
  guru?: Profile;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string | null;
  is_published: boolean;
  created_at: string;
  author?: Profile;
}
