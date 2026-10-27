import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { fold, type Snapshot } from "../src/lib/domain";
const s: Snapshot = JSON.parse(await readFile("data/snapshot.json", "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw Error(
    "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local ou nos secrets do workflow.",
  );
if (!s.coverage.complete || s.works.length !== s.coverage.works)
  throw Error("Snapshot incompleto");
const db = createClient(url, key, { auth: { persistSession: false } });
const id = createHash("sha256")
    .update(JSON.stringify(s))
    .digest("hex")
    .slice(0, 24),
  { works, agents, ...metadata } = s;
async function check(p: PromiseLike<{ error: unknown }>) {
  const r = await p;
  if (r.error) throw r.error;
}
const active = await db
  .from("active_dataset")
  .select("dataset_id")
  .maybeSingle();
if (active.data?.dataset_id === id) {
  console.log("Versão já ativa; nenhuma duplicação.");
  process.exit(0);
}
await check(db.from("datasets").upsert({ id, state: "staging", metadata }));
try {
  await check(db.from("municipalities").upsert(s.municipalities));
  for (let n = 0; n < agents.length; n += 200)
    await check(
      db
        .from("agents")
        .upsert(
          agents
            .slice(n, n + 200)
            .map((a) => ({ ...a, published: true, official: true })),
        ),
    );
  for (let n = 0; n < works.length; n += 100) {
    const batch = works.slice(n, n + 100);
    await check(
      db
        .from("works")
        .upsert(
          batch.map((w) => ({
            dataset_id: id,
            id: w.id,
            name: w.name,
            status: w.status,
            category: w.category,
            municipality_ids: w.municipalityIds,
            planned: w.planned,
            search_text: fold(w.name + " " + w.id),
            data: w,
          })),
        ),
    );
    const municipalities = batch.flatMap((w) =>
      w.municipalityIds.map((m) => ({
        dataset_id: id,
        work_id: w.id,
        municipality_id: m,
      })),
    );
    if (municipalities.length)
      await check(db.from("work_municipalities").upsert(municipalities));
    const locations = batch.flatMap((w) =>
      w.locations.map((p) => ({
        dataset_id: id,
        work_id: w.id,
        longitude: p.lng,
        latitude: p.lat,
      })),
    );
    if (locations.length) await check(db.from("locations").upsert(locations));
    const links = batch.flatMap((w) =>
      w.links.map((l) => ({
        dataset_id: id,
        id: l.id,
        work_id: l.workId,
        agent_id: l.agentId,
        role: l.role,
        source: l.source,
        consulted_at: l.consultedAt,
      })),
    );
    if (links.length) await check(db.from("official_links").upsert(links));
    console.log(`Carga ${Math.min(n + 100, works.length)}/${works.length}`);
  }
  await check(db.from("datasets").update({ state: "complete" }).eq("id", id));
  await check(db.rpc("activate_dataset", { target_id: id }));
  // Retém a versão ativa e a versão anterior. Complementações manuais não são tocadas.
  const retention = Math.max(2, Number(process.env.SNAPSHOT_RETENTION) || 2);
  const versions = await db
    .from("datasets")
    .select("id")
    .eq("state", "complete")
    .order("created_at", { ascending: false });
  if (versions.error) throw versions.error;
  const obsolete = versions.data
    .slice(retention)
    .map((v) => v.id)
    .filter((v) => v !== id);
  if (obsolete.length)
    await check(db.from("datasets").delete().in("id", obsolete));
  console.log(`Versão ${id} ativada com ${works.length} obras.`);
  await check(
    db.rpc("record_sync_run", {
      run_state: "complete",
      run_details: { dataset: id, works: works.length, coverage: s.coverage },
    }),
  );
} catch (error) {
  await db.from("datasets").update({ state: "failed" }).eq("id", id);
  await db.rpc("record_sync_run", {
    run_state: "failed",
    run_details: { dataset: id, error: String(error) },
  });
  throw error;
}
