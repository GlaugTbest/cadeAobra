import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls; create schema auth;create schema storage;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security; grant usage on schema auth,storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated;`,
  );
  await db.exec(
    `create table auth.users(id uuid primary key);insert into auth.users values('${admin}');`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027123019_initial_schema.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027125009_admin_operations.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027130955_public_queries.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027175000_public_explorer_insights.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027181000_descriptive_work_order.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into private.administrators values ('${admin}');insert into public.datasets(id,state,metadata) values('v1','complete','{"coverage":{"works":1}}');insert into public.works(dataset_id,id,name,status,category,municipality_ids,data) values('v1','w','Escola','Cadastrada','Educação',array['2200019'],'{}'); insert into public.active_dataset values(true,'v1');insert into public.agents(id,name,type,published) values('a','Responsável','person',true);insert into public.evidence(id,title,issuer,url,excerpt,evidence_date,is_public) values('11111111-1111-4111-8111-111111111112','Documento','Órgão','https://gov.br/doc','Página 1','2026-10-27',true);insert into public.manual_links(id,work_id,agent_id,role,evidence_id,state) values('11111111-1111-4111-8111-111111111113','w','a','Fiscal','11111111-1111-4111-8111-111111111112','draft');`,
  );
});
afterAll(() => db.close());
async function as(role: string, sql: string, uid = "") {
  await db.exec(
    `set role ${role};select set_config('request.jwt.claim.sub','${uid}',false)`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
it("público lê obras ativas mas não rascunhos, evidências ou auditoria", async () => {
  expect((await as("anon", "select * from works")).rows).toHaveLength(1);
  expect((await as("anon", "select * from manual_links")).rows).toHaveLength(0);
  expect((await as("anon", "select * from evidence")).rows).toHaveLength(0);
  await expect(as("anon", "select * from private.audit_log")).rejects.toThrow();
});
it("público e autenticado comum não escrevem nem se promovem", async () => {
  for (const r of ["anon", "authenticated"])
    await expect(
      as(
        r,
        "insert into agents(id,name,type) values('bad','Invasor','person')",
      ),
    ).rejects.toThrow();
  await expect(
    as(
      "authenticated",
      `insert into private.administrators values('${admin}')`,
    ),
  ).rejects.toThrow();
});
it("admin publica somente após revisão com evidência pública", async () => {
  const where = "where id='11111111-1111-4111-8111-111111111113'";
  await expect(
    as(
      "authenticated",
      `update manual_links set state='published' ${where}`,
      admin,
    ),
  ).rejects.toThrow("revisão");
  await as(
    "authenticated",
    `update manual_links set state='review' ${where}`,
    admin,
  );
  await as(
    "authenticated",
    `update manual_links set state='published' ${where}`,
    admin,
  );
  expect((await as("anon", "select * from manual_links")).rows).toHaveLength(1);
  expect((await as("anon", "select * from evidence")).rows).toHaveLength(1);
  expect(
    (await as("authenticated", "select * from private.audit_log", admin)).rows
      .length,
  ).toBeGreaterThan(1);
});
it("importação parcial não ativa dados nem remove curadoria", async () => {
  await db.exec(
    `insert into datasets(id,state,metadata) values('v2','staging','{"coverage":{"works":2}}')`,
  );
  await expect(db.query("select activate_dataset('v2')")).rejects.toThrow();
  expect((await as("anon", "select * from works")).rows).toHaveLength(1);
  expect((await as("anon", "select * from manual_links")).rows).toHaveLength(1);
});
it("arquivos privados permanecem inacessíveis ao público", async () => {
  await db.exec(
    "insert into storage.objects(bucket_id,name) values('evidence','private.pdf')",
  );
  expect((await as("anon", "select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await expect(
    as(
      "anon",
      "insert into storage.objects(bucket_id,name) values('evidence','attack.pdf')",
    ),
  ).rejects.toThrow();
});
it("curadoria não pode sobrescrever perfil importado e usuário comum não ganha papel", async () => {
  await db.exec(
    "insert into agents(id,name,type,published,official) values('official','Órgão real','organization',true,true)",
  );
  await expect(
    as(
      "authenticated",
      "update agents set name='Alterado',official=false where id='official' returning *",
      admin,
    ),
  ).resolves.toMatchObject({ rows: [] });
  expect(
    (await as("authenticated", "select am_i_admin()", admin)).rows,
  ).toEqual([{ am_i_admin: true }]);
  expect(
    (
      await as(
        "authenticated",
        "select am_i_admin()",
        "22222222-2222-4222-8222-222222222222",
      )
    ).rows,
  ).toEqual([{ am_i_admin: false }]);
  await expect(as("anon", "select activate_dataset('v1')")).rejects.toThrow();
});
it("busca e agregação no banco respeitam filtros e não revelam rascunhos", async () => {
  await db.exec(
    "insert into agents(id,name,type,published) values('empty','João Sem Vínculo','person',true),('hidden','João Rascunho','person',false)",
  );
  const query = (await as("anon", "select list_public_works('2200019') data"))
    .rows as { data: any }[];
  expect(query[0].data.totals.count).toBe(1);
  expect(query[0].data.statusCounts.Cadastrada).toBe(1);
  expect(query[0].data.counts["2200019"]).toBe(1);
  expect(query[0].data.items).toHaveLength(1);
  const search = (await as("anon", "select search_public('joao') data"))
    .rows as { data: any }[];
  expect(search[0].data.agents.map((a: any) => a.id)).toEqual(["empty"]);
  const profile = (
    await as("anon", "select list_public_works('','','','empty') data")
  ).rows as { data: any }[];
  expect(profile[0].data.agent.name).toBe("João Sem Vínculo");
  expect(profile[0].data.items).toEqual([]);
});
