create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create table private.administrators (user_id uuid primary key references auth.users(id) on delete cascade);
-- auth.users FK is supplied by Supabase Auth in production.
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from private.administrators where user_id=auth.uid())
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to anon;
grant execute on function private.is_admin() to anon,authenticated,service_role;
alter table private.administrators enable row level security;
create table public.datasets(id text primary key,state text not null check(state in ('staging','complete','failed')),metadata jsonb not null,created_at timestamptz not null default now());
create table public.active_dataset(singleton boolean primary key default true check(singleton),dataset_id text not null references public.datasets(id));
create table public.municipalities(id text primary key,name text not null,uf text not null);
create table public.works(dataset_id text not null references public.datasets(id) on delete cascade,id text not null,name text not null,status text not null,category text not null,municipality_ids text[] not null default '{}',planned numeric,search_text text not null default '',data jsonb not null,primary key(dataset_id,id));
create index works_filters on public.works(dataset_id,status,category);
create index works_municipalities on public.works using gin(municipality_ids);
create table public.work_municipalities(dataset_id text not null,work_id text not null,municipality_id text not null references public.municipalities(id),primary key(dataset_id,work_id,municipality_id),foreign key(dataset_id,work_id) references public.works(dataset_id,id) on delete cascade);
create index work_municipalities_city on public.work_municipalities(municipality_id,dataset_id);
create table public.locations(dataset_id text not null,work_id text not null,longitude double precision not null check(longitude between -180 and 180),latitude double precision not null check(latitude between -90 and 90),primary key(dataset_id,work_id,longitude,latitude),foreign key(dataset_id,work_id) references public.works(dataset_id,id) on delete cascade);
create table public.agents(id text primary key,name text not null,type text not null check(type in ('person','organization')),identifier text,description text,published boolean not null default false,official boolean not null default false);
create index agents_name on public.agents(name);
create table public.official_links(dataset_id text not null, id text not null,work_id text not null,agent_id text not null references public.agents(id),role text not null,source text not null,consulted_at timestamptz not null,primary key(dataset_id,id),foreign key(dataset_id,work_id) references public.works(dataset_id,id) on delete cascade);
create index official_links_agent on public.official_links(agent_id,dataset_id);
create table public.evidence(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 300),issuer text not null,url text,excerpt text not null check(length(excerpt)>0),evidence_date date not null,file_path text,is_public boolean not null default false,file_public boolean not null default false,created_at timestamptz not null default now(),check(url is not null or file_path is not null),check(url is null or url ~ '^https://([a-zA-Z0-9-]+\.)*(gov|jus|leg|mp|edu)\.br(/|$)'),check(not file_public or is_public));
create table public.manual_links(id uuid primary key default gen_random_uuid(),work_id text not null,agent_id text not null references public.agents(id),role text not null check(length(role) between 1 and 200),period_start date,period_end date,evidence_id uuid not null references public.evidence(id),state text not null default 'draft' check(state in('draft','review','published')),created_by uuid default auth.uid(),updated_at timestamptz not null default now(),check(period_end is null or period_start is null or period_end>=period_start));
create index manual_links_agent on public.manual_links(agent_id,state);
create index manual_links_work on public.manual_links(work_id,state);
create table private.audit_log(id bigint generated always as identity primary key,actor uuid,entity text not null,entity_id text,action text not null,old_data jsonb,new_data jsonb,changed_at timestamptz not null default now());
create table private.sync_runs(id uuid primary key default gen_random_uuid(),state text not null,started_at timestamptz not null default now(),finished_at timestamptz,details jsonb);
alter table private.audit_log enable row level security;
alter table private.sync_runs enable row level security;
create policy admin_audit on private.audit_log for select to authenticated using(private.is_admin());
create policy admin_runs on private.sync_runs for select to authenticated using(private.is_admin());
grant select on private.audit_log,private.sync_runs to authenticated;
grant all on all tables in schema private to service_role;
grant usage,select on all sequences in schema private to service_role;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.audit_log(actor,entity,entity_id,action,old_data,new_data) values(auth.uid(),tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id'),tg_op,to_jsonb(old),to_jsonb(new));
 return coalesce(new,old);
end $$;
revoke all on function private.audit_change() from public;
create trigger audit_links after insert or update or delete on public.manual_links for each row execute function private.audit_change();
create trigger audit_agents after insert or update or delete on public.agents for each row execute function private.audit_change();
create trigger audit_evidence after insert or update or delete on public.evidence for each row execute function private.audit_change();

create function private.validate_publication() returns trigger language plpgsql set search_path='' as $$
begin
 if new.state='published' then
  if tg_op='INSERT' or (old.state<>'review' and old.state<>'published') then raise exception 'Envie para revisão antes de publicar'; end if;
  if old.state='published' and (new.evidence_id<>old.evidence_id or new.agent_id<>old.agent_id or new.work_id<>old.work_id or new.role<>old.role or new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end) then raise exception 'Volte a rascunho antes de alterar vínculo publicado'; end if;
  if not exists(select 1 from public.evidence e where e.id=new.evidence_id and e.is_public and length(e.excerpt)>0) then raise exception 'Evidência pública obrigatória'; end if;
  if not exists(select 1 from public.agents a where a.id=new.agent_id and a.published) then raise exception 'Publique o perfil primeiro'; end if;
  if not exists(select 1 from public.works w join public.active_dataset d on d.dataset_id=w.dataset_id where w.id=new.work_id) then raise exception 'Obra não encontrada na base ativa'; end if;
 end if;
 new.updated_at=now();return new;
end $$;
create trigger validate_link before insert or update on public.manual_links for each row execute function private.validate_publication();
create function private.lock_evidence() returns trigger language plpgsql set search_path='' as $$begin
 if exists(select 1 from public.manual_links where evidence_id=old.id and state='published') then raise exception 'Evidência publicada é imutável; crie uma nova revisão';end if;return coalesce(new,old);end$$;
create trigger lock_evidence before update or delete on public.evidence for each row execute function private.lock_evidence();

do $$declare t text;begin foreach t in array array['datasets','active_dataset','municipalities','works','work_municipalities','locations','agents','official_links','evidence','manual_links'] loop
 execute format('alter table public.%I enable row level security',t);
end loop;end$$;
create policy public_active on public.active_dataset for select using(true);
create policy public_datasets on public.datasets for select using(id in(select dataset_id from public.active_dataset) or private.is_admin());
create policy public_municipalities on public.municipalities for select using(true);
create policy public_works on public.works for select using(dataset_id in(select dataset_id from public.active_dataset) or private.is_admin());
create policy public_work_municipalities on public.work_municipalities for select using(dataset_id in(select dataset_id from public.active_dataset) or private.is_admin());
create policy public_locations on public.locations for select using(dataset_id in(select dataset_id from public.active_dataset) or private.is_admin());
create policy public_official_links on public.official_links for select using(dataset_id in(select dataset_id from public.active_dataset) or private.is_admin());
create policy public_agents on public.agents for select using(published or private.is_admin());
create policy public_manual_links on public.manual_links for select using((state='published' and exists(select 1 from public.agents a where a.id=agent_id and a.published)) or private.is_admin());
create policy public_evidence on public.evidence for select using((is_public and exists(select 1 from public.manual_links l where l.evidence_id=evidence.id and l.state='published')) or private.is_admin());
create policy admin_agents on public.agents for all to authenticated using(private.is_admin()) with check(private.is_admin() and not official);
create policy admin_manual_links on public.manual_links for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy admin_evidence on public.evidence for all to authenticated using(private.is_admin()) with check(private.is_admin());
grant select on public.datasets,public.active_dataset,public.municipalities,public.works,public.work_municipalities,public.locations,public.agents,public.official_links,public.manual_links,public.evidence to anon,authenticated;
grant insert,update,delete on public.agents,public.manual_links,public.evidence to authenticated;
grant all on all tables in schema public to service_role;

create function public.activate_dataset(target_id text) returns void language plpgsql set search_path='' as $$
declare expected bigint;actual bigint;begin
 select (metadata->'coverage'->>'works')::bigint into expected from public.datasets where id=target_id and state='complete';
 select count(*) into actual from public.works where dataset_id=target_id;
 if expected is null or expected<>actual or actual=0 then raise exception 'Importação incompleta';end if;
 insert into public.active_dataset values(true,target_id) on conflict(singleton) do update set dataset_id=excluded.dataset_id;
end$$;
revoke all on function public.activate_dataset(text) from public,anon,authenticated;
grant execute on function public.activate_dataset(text) to service_role;
create function public.am_i_admin() returns boolean language sql stable security invoker set search_path='' as $$select private.is_admin()$$;
revoke all on function public.am_i_admin() from public;
grant execute on function public.am_i_admin() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,5242880,array['application/pdf']) on conflict(id) do nothing;
create policy admin_storage on storage.objects for all to authenticated using(bucket_id='evidence' and private.is_admin()) with check(bucket_id='evidence' and private.is_admin());
create policy published_documents on storage.objects for select to anon,authenticated using(bucket_id='evidence' and exists(select 1 from public.evidence e where e.file_path=name and e.file_public and e.is_public));
