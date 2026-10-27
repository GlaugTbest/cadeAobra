create function public.fold_text(value text) returns text language sql immutable parallel safe set search_path='' as $$ select translate(lower(value),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') $$;
create function public.search_public(p_query text) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'municipalities',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,name,uf from public.municipalities where position(public.fold_text(left(p_query,120)) in public.fold_text(name))>0 order by name limit 10)t),'[]'),
 'works',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,name,status,category,planned,municipality_ids as "municipalityIds" from public.works where dataset_id=(select dataset_id from public.active_dataset) and position(public.fold_text(left(p_query,120)) in public.fold_text(name||' '||id))>0 order by name,id limit 6)t),'[]'),
 'agents',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,name,type,identifier,description from public.agents where published and position(public.fold_text(left(p_query,120)) in public.fold_text(name))>0 order by name,id limit 6)t),'[]')
)
$$;
create function public.list_public_works(p_city text default '',p_status text default '',p_category text default '',p_agent text default '',p_role text default '',p_page integer default 1) returns jsonb language sql stable security invoker set search_path='' as $$
with active as(select dataset_id from public.active_dataset),
 filtered as materialized (
 select w.* from public.works w where w.dataset_id=(select dataset_id from active)
 and (p_city='' or p_city=any(w.municipality_ids)) and(p_status='' or w.status=p_status) and(p_category='' or w.category=p_category)
 and(p_agent='' or exists(select 1 from public.official_links l where l.dataset_id=w.dataset_id and l.work_id=w.id and l.agent_id=p_agent and(p_role='' or l.role=p_role)) or exists(select 1 from public.manual_links l where l.work_id=w.id and l.agent_id=p_agent and l.state='published' and(p_role='' or l.role=p_role)))
 ), page_rows as(select * from filtered order by name,id limit 30 offset ((greatest(1,least(coalesce(p_page,1),10000))-1)*30))
 select jsonb_build_object(
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status,'category',category,'planned',planned,'municipalityIds',municipality_ids,'hasLocation',jsonb_array_length(coalesce(data->'locations','[]'))>0,'roles','[]'::jsonb)) from page_rows),'[]'),
 'page',greatest(1,least(coalesce(p_page,1),10000)), 'pages',(select ceil(count(*)/30.0) from filtered),
 'totals',(select jsonb_build_object('count',count(*),'planned',coalesce(sum(planned),0),'known',count(planned)) from filtered),
 'counts',coalesce((select jsonb_object_agg(city,total) from(select unnest(municipality_ids) city,count(*) total from filtered group by city)c),'{}'),
 'statuses',(select jsonb_agg(s.status order by s.status) from(select distinct status from public.works where dataset_id=(select dataset_id from active))s),
 'categories',(select jsonb_agg(c.category order by c.category) from(select distinct category from public.works where dataset_id=(select dataset_id from active))c),
 'municipality',(select to_jsonb(m) from public.municipalities m where id=p_city),
 'agent',(select to_jsonb(a) from public.agents a where id=p_agent and published),
 'roles',coalesce((select jsonb_agg(r.role order by r.role) from(select role from public.official_links where dataset_id=(select dataset_id from active) and agent_id=p_agent union select role from public.manual_links where state='published' and agent_id=p_agent)r),'[]'),
 'points',case when p_city<>'' or p_agent<>'' then coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'status',w.status,'lng',(p->>'lng')::numeric,'lat',(p->>'lat')::numeric)) from filtered w cross join lateral jsonb_array_elements(coalesce(w.data->'locations','[]'))p),'[]') else '[]'::jsonb end,
 'metadata',(select jsonb_build_object('version',metadata->'version','consultedAt',metadata->'consultedAt','sourceUpdatedAt',metadata->'sourceUpdatedAt','coverage',metadata->'coverage','curationAvailable',true) from public.datasets where id=(select dataset_id from active))
 )
$$;
revoke all on function public.fold_text(text),public.search_public(text),public.list_public_works(text,text,text,text,text,integer) from public;
grant execute on function public.fold_text(text),public.search_public(text),public.list_public_works(text,text,text,text,text,integer) to anon,authenticated,service_role;
