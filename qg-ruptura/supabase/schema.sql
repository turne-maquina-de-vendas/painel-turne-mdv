-- Rode uma vez no SQL Editor do Supabase.
create table if not exists public.ruptura_kv (
  chave text primary key,
  valor jsonb not null,
  versao bigint not null
);

-- RLS ligado e sem política: só a service role, usada no servidor, lê e grava. A chave anon não acessa nada.
alter table public.ruptura_kv enable row level security;

-- Bucket privado das imagens dos mockups.
insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', false)
on conflict (id) do nothing;
