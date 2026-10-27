// Provisionamento pela conexão MCP, quando não existe chave de serviço local.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const s = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
const id = createHash("sha256")
  .update(JSON.stringify(s))
  .digest("hex")
  .slice(0, 24);
const literal = (x) =>
  "'" + JSON.stringify(x).replaceAll("'", "''") + "'::jsonb";
const mode = process.argv[2],
  offset = Number(process.argv[3] || 0),
  limit = Number(process.argv[4] || 100);
const { works, agents, ...metadata } = s;
if (mode === "init")
  console.log(
    `insert into datasets(id,state,metadata) values('${id}','staging',${literal(metadata)}) on conflict(id) do nothing;insert into municipalities select * from jsonb_populate_recordset(null::municipalities,${literal(s.municipalities)}) on conflict(id) do update set name=excluded.name;`,
  );
else if (mode === "agents")
  console.log(
    `insert into agents select * from jsonb_populate_recordset(null::agents,${literal(agents.slice(offset, offset + limit).map((a) => ({ ...a, official: true, published: true })))}) on conflict(id) do nothing;`,
  );
else if (mode === "batch") {
  const batch = works.slice(offset, offset + limit);
  const records = batch.map((w) => ({
    dataset_id: id,
    id: w.id,
    name: w.name,
    status: w.status,
    category: w.category,
    municipality_ids: w.municipalityIds,
    planned: w.planned,
    search_text: w.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
    data: w,
  }));
  console.log(
    `insert into works select * from jsonb_populate_recordset(null::works,${literal(records)}) on conflict(dataset_id,id) do nothing;`,
  );
} else if (mode === "finish")
  console.log(
    `insert into work_municipalities select w.dataset_id,w.id,unnest(w.municipality_ids) from works w where dataset_id='${id}' on conflict do nothing;insert into locations select w.dataset_id,w.id,(p->>'lng')::double precision,(p->>'lat')::double precision from works w cross join lateral jsonb_array_elements(w.data->'locations') p where dataset_id='${id}' on conflict do nothing;insert into official_links select w.dataset_id,l->>'id',w.id,l->>'agentId',l->>'role',l->>'source',(l->>'consultedAt')::timestamptz from works w cross join lateral jsonb_array_elements(w.data->'links') l where dataset_id='${id}' on conflict do nothing;update datasets set state='complete' where id='${id}';select activate_dataset('${id}');`,
  );
