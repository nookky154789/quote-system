-- =====================================================================
--  ระบบประมาณราคา / เสนอราคา / เบิกของ  —  Supabase schema
--  วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
--  รันซ้ำได้ ไม่ทำให้ข้อมูลหาย
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- ผู้ใช้ + สิทธิ์ ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_.-]{3,}$'),
  name       text not null default '',
  email      text,
  role       text not null default 'viewer' check (role in ('admin','editor','viewer','custom')),
  perms      jsonb not null default '{}'::jsonb,
  disabled   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- ข้อมูลทั้งหมดของระบบ (วัสดุ ใบประมาณ ใบเสนอ ฯลฯ) ----------
create table if not exists public.records (
  col        text not null,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (col, id)
);
create index if not exists records_col_idx on public.records (col);

create or replace function public.records_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- ---------- ฟังก์ชันตรวจสิทธิ์ (ฝั่งเซิร์ฟเวอร์ — ข้ามไม่ได้) ----------
-- ระดับ: 0 = ไม่เห็น, 1 = ดูอย่างเดียว, 2 = แก้ไขได้
create or replace function public.my_level(mod text) returns int
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; v text;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found or p.disabled then return 0; end if;
  if p.role = 'admin'  then return 2; end if;
  if p.role = 'editor' then return case when mod = 'settings' then 1 else 2 end; end if;
  if p.role = 'viewer' then return case when mod = 'settings' then 0 else 1 end; end if;
  v := coalesce(p.perms ->> mod, 'none');
  return case v when 'edit' then 2 when 'view' then 1 else 0 end;
end $$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not disabled) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not disabled) $$;

create or replace function public.col_level(c text, rid text) returns int
language sql stable security definer set search_path = public as $$
  select case c
    when 'items'       then greatest(public.my_level('items'), public.my_level('withdrawals'))
    when 'moves'       then greatest(public.my_level('items'), public.my_level('withdrawals'))
    when 'estimates'   then public.my_level('estimates')
    when 'quotes'      then public.my_level('quotes')
    when 'withdrawals' then public.my_level('withdrawals')
    when 'jobs'        then public.my_level('jobs')
    when 'boms'        then public.my_level('boms')
    when 'settings'    then case when rid = 'bomFolders' then public.my_level('boms')
                                 else public.my_level('settings') end
    else 0 end $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.records  enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_select on public.records for select to authenticated
  using ( public.col_level(col, id) >= 1 or (col = 'settings' and public.is_active()) );
create policy records_insert on public.records for insert to authenticated
  with check ( public.col_level(col, id) >= 2 );
create policy records_update on public.records for update to authenticated
  using ( public.col_level(col, id) >= 2 ) with check ( public.col_level(col, id) >= 2 );
create policy records_delete on public.records for delete to authenticated
  using ( public.col_level(col, id) >= 2 );

-- ไม่ให้คนที่ยังไม่ล็อกอินแตะตารางโดยตรง
revoke all on public.records  from anon;
revoke all on public.profiles from anon;

-- ---------- ฟังก์ชันที่หน้าเว็บเรียกใช้ ----------
-- 1) ชื่อผู้ใช้ -> อีเมลที่ใช้ล็อกอิน (ไม่บอกว่ามีผู้ใช้นี้จริงไหม)
create or replace function public.login_email(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select email from public.profiles where username = lower(trim(p_username))),
                  lower(trim(p_username)) || '@zensocon.app') $$;

-- 2) มีผู้ดูแลระบบแล้วหรือยัง (ใช้ตัดสินว่าจะแสดงหน้า "ตั้งค่าครั้งแรก")
create or replace function public.has_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'admin') $$;

-- 3) คนแรกที่สมัคร กดรับตำแหน่งผู้ดูแลระบบ (ทำได้ครั้งเดียว ตอนยังไม่มีผู้ดูแล)
create or replace function public.claim_admin(p_username text, p_name text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.profiles where role = 'admin') then raise exception 'admin already exists'; end if;
  insert into public.profiles (id, username, name, email, role)
  values (auth.uid(), lower(trim(p_username)), coalesce(nullif(trim(p_name), ''), p_username), p_email, 'admin');
end $$;

-- 4) ผู้ดูแลตั้งรหัสผ่านใหม่ให้ผู้ใช้
create or replace function public.admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'password too short'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
   where id = p_user;
end $$;

-- 5) ผู้ดูแลลบผู้ใช้ (ลบตัวเองไม่ได้)
create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_user = auth.uid() then raise exception 'cannot delete yourself'; end if;
  delete from auth.users where id = p_user;
end $$;

revoke execute on function public.admin_set_password(uuid, text) from public, anon;
revoke execute on function public.admin_delete_user(uuid)        from public, anon;
revoke execute on function public.claim_admin(text, text, text)  from public, anon;
grant  execute on function public.admin_set_password(uuid, text) to authenticated;
grant  execute on function public.admin_delete_user(uuid)        to authenticated;
grant  execute on function public.claim_admin(text, text, text)  to authenticated;
grant  execute on function public.login_email(text)              to anon, authenticated;
grant  execute on function public.has_admin()                    to anon, authenticated;

-- ---------- อัปเดตหน้าจอแบบเรียลไทม์ (คนอื่นแก้ เห็นทันที) ----------
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------- ที่เก็บไฟล์แบบ PDF (แนบกับ BOM) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drawings', 'drawings', false, 52428800, array['application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
drop policy if exists drawings_select on storage.objects;
drop policy if exists drawings_insert on storage.objects;
drop policy if exists drawings_update on storage.objects;
drop policy if exists drawings_delete on storage.objects;
create policy drawings_select on storage.objects for select to authenticated using (bucket_id = 'drawings' and public.my_level('boms') >= 1);
create policy drawings_insert on storage.objects for insert to authenticated with check (bucket_id = 'drawings' and public.my_level('boms') >= 2);
create policy drawings_update on storage.objects for update to authenticated using (bucket_id = 'drawings' and public.my_level('boms') >= 2) with check (bucket_id = 'drawings' and public.my_level('boms') >= 2);
create policy drawings_delete on storage.objects for delete to authenticated using (bucket_id = 'drawings' and public.my_level('boms') >= 2);
