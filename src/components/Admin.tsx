"use client";
import { useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, LogOut, Plus, Check, ExternalLink } from "lucide-react";
import { date, type Raw } from "@/lib/domain";
const roles = [
  "Responsável técnico pelo projeto",
  "Responsável técnico pela execução",
  "Responsável técnico pela fiscalização",
  "Empresa contratada",
  "Fornecedor",
  "Órgão gestor",
  "Órgão executor",
  "Contratante",
  "Tomador",
  "Repassador",
  "Autor de emenda parlamentar",
  "Gestor documentado",
  "Signatário",
];
export default function Admin() {
  const [data, setData] = useState<Raw | null>(null),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("links"),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<Raw | null>(null),
    [authenticated, setAuthenticated] = useState(false),
    [setup, setSetup] = useState(false),
    [file, setFile] = useState("");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const [db] = useState(() =>
    url && key ? createBrowserClient(url, key) : null,
  );
  async function load() {
    const r = await fetch("/api/admin", { cache: "no-store" }),
      d = await r.json();
    if (r.ok) {
      setData(d);
      setAuthenticated(true);
    } else {
      setMessage(d.error);
      if (r.status === 401) setAuthenticated(false);
    }
  }
  useEffect(() => {
    if (!db) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "invite" || hash.get("type") === "recovery")
      setSetup(true);
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAuthenticated(true);
        if (event === "PASSWORD_RECOVERY") setSetup(true);
        setTimeout(load, 0);
      }
    });
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthenticated(true);
        load();
      }
    });
    return () => subscription.unsubscribe();
  }, [db]);
  async function post(body: Raw) {
    const r = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  function handle(patch: Raw) {
    setForm((f) => ({ ...f, ...patch }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setMessage("");
    try {
      if (form.action === "agent") {
        await post(form);
        setMessage(
          "Perfil salvo. A publicação do perfil e a do vínculo são independentes.",
        );
      } else {
        const evidence = await post({
          action: "evidence",
          title: form.title,
          issuer: form.issuer,
          url: form.url,
          excerpt: form.excerpt,
          evidence_date: form.evidence_date,
          is_public: form.is_public,
          file_public: form.file_public,
          file_path: file || form.file_path,
        });
        await post({ ...form, action: "link", evidence_id: evidence.id });
        setMessage(
          "Vínculo salvo como rascunho. Envie para revisão antes de publicar.",
        );
      }
      setForm(null);
      setFile("");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeState(id: string, state: string) {
    setBusy(true);
    try {
      await post({ action: "state", id, state });
      setMessage(
        state === "published"
          ? "Vínculo publicado com evidência."
          : "Estado atualizado.",
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": f.type },
          body: f,
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setFile(d.file_path);
      setMessage(
        "PDF armazenado de forma privada. A publicação exige a opção explícita abaixo.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page">
      <header className="topbar">
        <a className="brand" href="/">
          cadê a <strong>obra?</strong>
        </a>
        <a className="admin-nav" style={{ display: "flex" }} href="/">
          <ArrowLeft size={14} />
          Voltar ao mapa
        </a>
      </header>
      <div className="admin-main">
        {!db ? (
          <>
            <h1>Administração</h1>
            <p>
              Configure a conexão Supabase para autenticação, curadoria e
              evidências privadas. As instruções estão no README do projeto.
            </p>
          </>
        ) : !authenticated ? (
          <div className="admin-login">
            <h1>
              Entre para cuidar
              <br />
              da informação.
            </h1>
            <p className="admin-help">
              Acesso exclusivo a administradores autorizados. Sem cadastro
              público.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                const r = await db.auth.signInWithPassword({
                  email: String(f.get("email")),
                  password: String(f.get("password")),
                });
                setBusy(false);
                if (r.error)
                  setMessage(
                    "Não foi possível entrar. Confira e-mail e senha.",
                  );
                else {
                  setMessage("");
                  await load();
                }
              }}
            >
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="primary-button" disabled={busy}>
                {busy ? "Entrando…" : "Entrar"}
              </button>
            </form>
            <p className="admin-help">
              Se recebeu um convite, abra o link no e-mail para definir sua
              senha.
            </p>
          </div>
        ) : setup ? (
          <div className="admin-login">
            <h1>Defina sua senha</h1>
            <p className="admin-help">
              Use pelo menos 12 caracteres para proteger a curadoria.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const password = String(
                  new FormData(e.currentTarget).get("password"),
                );
                setBusy(true);
                const r = await db.auth.updateUser({ password });
                setBusy(false);
                if (r.error) setMessage(r.error.message);
                else {
                  setSetup(false);
                  setMessage("Senha definida.");
                  await load();
                }
              }}
            >
              <label>
                Nova senha
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="primary-button" disabled={busy}>
                Salvar senha
              </button>
            </form>
          </div>
        ) : (
          <>
            <h1>Curadoria com evidência</h1>
            <p>
              Perfis, papéis e documentos que tornam os vínculos verificáveis.
            </p>
            <div className="admin-toolbar">
              <div className="admin-tabs">
                {[
                  ["links", "Vínculos"],
                  ["agents", "Perfis"],
                  ["history", "Histórico"],
                  ["runs", "Sincronização"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={tab === id ? "active" : ""}
                    onClick={() => {
                      setTab(id);
                      setForm(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={async () => {
                  await db.auth.signOut();
                  setData(null);
                  setAuthenticated(false);
                  setMessage("");
                }}
                aria-label="Sair da administração"
              >
                <LogOut size={18} />
              </button>
            </div>
            {data && <p className="admin-help">Sessão: {data.email}</p>}
            {["links", "agents"].includes(tab) && !form && (
              <button
                className="primary-button"
                onClick={() => {
                  setFile("");
                  setForm(
                    tab === "agents"
                      ? { action: "agent", type: "person", published: false }
                      : {
                          action: "link",
                          role: roles[0],
                          is_public: false,
                          file_public: false,
                        },
                  );
                }}
              >
                <Plus size={15} />
                {tab === "agents" ? "Criar perfil" : "Criar vínculo"}
              </button>
            )}
            {form && (
              <form onSubmit={submit}>
                <h2>
                  {form.action === "agent"
                    ? "Perfil público"
                    : "Vínculo documentado"}
                </h2>
                <div className="admin-form">
                  {form.action === "agent" ? (
                    <>
                      <label>
                        Nome completo ou razão social
                        <input
                          value={form.name || ""}
                          onChange={(e) => handle({ name: e.target.value })}
                          required
                          maxLength={200}
                        />
                      </label>
                      <label>
                        Tipo
                        <select
                          value={form.type}
                          onChange={(e) => handle({ type: e.target.value })}
                        >
                          <option value="person">Pessoa</option>
                          <option value="organization">Organização</option>
                        </select>
                      </label>
                      <label className="full-width">
                        Identificador profissional ou institucional público (sem
                        CPF)
                        <input
                          value={form.identifier || ""}
                          onChange={(e) =>
                            handle({ identifier: e.target.value })
                          }
                          maxLength={100}
                        />
                      </label>
                      <label className="full-width">
                        Descrição profissional ou institucional
                        <textarea
                          value={form.description || ""}
                          onChange={(e) =>
                            handle({ description: e.target.value })
                          }
                          maxLength={2000}
                        />
                      </label>
                      <label className="checkbox-label full-width">
                        <input
                          type="checkbox"
                          checked={form.published === true}
                          onChange={(e) =>
                            handle({ published: e.target.checked })
                          }
                        />
                        Publicar este perfil. Os vínculos continuam com seu
                        próprio estado de revisão.
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        Identificador completo da obra
                        <input
                          value={form.work_id || ""}
                          onChange={(e) => handle({ work_id: e.target.value })}
                          placeholder="Ex.: 47168.22-07"
                          required
                          maxLength={100}
                        />
                      </label>
                      <label>
                        Perfil
                        <select
                          value={form.agent_id || ""}
                          onChange={(e) => handle({ agent_id: e.target.value })}
                          required
                        >
                          <option value="">Selecione um perfil</option>
                          {data?.agents.map((a: Raw) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.published ? "" : " (rascunho)"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="full-width">
                        Papel comprovado
                        <select
                          value={form.role}
                          onChange={(e) => handle({ role: e.target.value })}
                        >
                          {roles.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Início do período
                        <input
                          type="date"
                          value={form.period_start || ""}
                          onChange={(e) =>
                            handle({ period_start: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Fim do período
                        <input
                          type="date"
                          value={form.period_end || ""}
                          onChange={(e) =>
                            handle({ period_end: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Título da evidência
                        <input
                          value={form.title || ""}
                          onChange={(e) => handle({ title: e.target.value })}
                          maxLength={300}
                          required
                        />
                      </label>
                      <label>
                        Órgão emissor
                        <input
                          value={form.issuer || ""}
                          onChange={(e) => handle({ issuer: e.target.value })}
                          maxLength={300}
                          required
                        />
                      </label>
                      <label>
                        URL oficial (HTTPS)
                        <input
                          type="url"
                          value={form.url || ""}
                          onChange={(e) => handle({ url: e.target.value })}
                          placeholder="https://www.gov.br/…"
                        />
                      </label>
                      <label>
                        Data do documento
                        <input
                          type="date"
                          value={form.evidence_date || ""}
                          onChange={(e) =>
                            handle({ evidence_date: e.target.value })
                          }
                          required
                        />
                      </label>
                      <label className="full-width">
                        Página e trecho que comprovam o papel
                        <textarea
                          value={form.excerpt || ""}
                          onChange={(e) => handle({ excerpt: e.target.value })}
                          required
                          maxLength={6000}
                        />
                      </label>
                      <label className="admin-file">
                        Ou anexar documento de trabalho
                        <input
                          type="file"
                          accept="application/pdf"
                          disabled={busy}
                          onChange={(e) => {
                            if (e.target.files?.[0]) upload(e.target.files[0]);
                          }}
                        />
                        <small>
                          PDF até 5 MB. O arquivo fica privado inicialmente.
                          Para divulgar uma cópia, oculte dados pessoais antes
                          do envio.
                        </small>
                        {(file || form.file_path) && (
                          <small>Documento privado anexado.</small>
                        )}
                      </label>
                      <label className="checkbox-label full-width">
                        <input
                          type="checkbox"
                          checked={form.is_public === true}
                          onChange={(e) =>
                            handle({ is_public: e.target.checked })
                          }
                        />
                        Autorizo publicar a referência e o trecho acima,
                        adequados à divulgação. Obrigatório para publicar o
                        vínculo.
                      </label>
                      <label className="checkbox-label full-width">
                        <input
                          type="checkbox"
                          checked={form.file_public === true}
                          onChange={(e) =>
                            handle({ file_public: e.target.checked })
                          }
                        />
                        Publicar também esta cópia PDF. Confirme que os dados
                        pessoais desnecessários foram ocultados.
                      </label>
                    </>
                  )}
                </div>
                <div className="form-actions">
                  <button className="primary-button" disabled={busy}>
                    {busy
                      ? "Salvando…"
                      : "Salvar " +
                        (form.action === "agent" ? "perfil" : "rascunho")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(null);
                      setFile("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {!form && tab === "links" && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Obra / perfil</th>
                    <th>Papel</th>
                    <th>Estado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.links.map((l: Raw) => (
                    <tr key={l.id}>
                      <td>
                        {l.work_id}
                        <small>{l.agents?.name}</small>
                      </td>
                      <td>
                        {l.role}
                        <small>{l.evidence?.title}</small>
                      </td>
                      <td>
                        {l.state === "draft"
                          ? "Rascunho"
                          : l.state === "review"
                            ? "Em revisão"
                            : "Publicado"}
                      </td>
                      <td>
                        {l.state === "draft" ? (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => {
                                const e = l.evidence;
                                setFile("");
                                setForm({
                                  ...l,
                                  action: "link",
                                  title: e.title,
                                  issuer: e.issuer,
                                  url: e.url,
                                  excerpt: e.excerpt,
                                  evidence_date: e.evidence_date,
                                  is_public: e.is_public,
                                  file_public: e.file_public,
                                  file_path: e.file_path,
                                });
                              }}
                            >
                              Editar
                            </button>
                            <br />
                            <button
                              disabled={busy}
                              onClick={() => changeState(l.id, "review")}
                            >
                              Enviar para revisão
                            </button>
                          </>
                        ) : l.state === "review" ? (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => changeState(l.id, "published")}
                            >
                              Publicar
                            </button>
                            <br />
                            <button
                              disabled={busy}
                              onClick={() => changeState(l.id, "draft")}
                            >
                              Voltar a rascunho
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={"/?obra=" + encodeURIComponent(l.work_id)}
                              target="_blank"
                            >
                              Ver publicação
                            </a>
                            <br />
                            <button
                              disabled={busy}
                              onClick={() => changeState(l.id, "draft")}
                            >
                              Retirar de publicação
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!form && tab === "agents" && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Publicação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.agents.map((a: Raw) => (
                    <tr key={a.id}>
                      <td>
                        {a.name}
                        <small>{a.identifier}</small>
                      </td>
                      <td>{a.type === "person" ? "Pessoa" : "Organização"}</td>
                      <td>{a.published ? "Publicado" : "Rascunho"}</td>
                      <td>
                        <button
                          onClick={() => setForm({ ...a, action: "agent" })}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!form && tab === "history" && (
              <>
                <p className="admin-help">
                  Últimas 100 alterações. O histórico registra o administrador,
                  o estado anterior e o novo estado.
                </p>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Quando / autor</th>
                      <th>Registro</th>
                      <th>Alteração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.history.map((h: Raw) => (
                      <tr key={h.id}>
                        <td>
                          {date(h.changed_at)}
                          <small>{h.actor || "Importador oficial"}</small>
                        </td>
                        <td>
                          {h.entity}
                          <small>{h.entity_id}</small>
                        </td>
                        <td>
                          <details>
                            <summary>{h.action}</summary>
                            <pre>
                              {JSON.stringify(
                                { antes: h.old_data, depois: h.new_data },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {!form && tab === "runs" && (
              <>
                <h2>Atualização dos dados</h2>
                <p className="admin-help">
                  A execução ocorre no workflow protegido do GitHub Actions ou
                  no computador do operador. Requisições públicas não iniciam
                  importações. A aplicação continua com a última base válida em
                  caso de falha.
                </p>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Início</th>
                      <th>Estado</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.runs.map((r: Raw) => (
                      <tr key={r.id}>
                        <td>{date(r.started_at)}</td>
                        <td>{r.state}</td>
                        <td>
                          <details>
                            <summary>Ver execução</summary>
                            <pre>{JSON.stringify(r.details, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {!form &&
              data &&
              ["agents", "links"].includes(tab) &&
              !data[tab].length && (
                <p className="admin-help">
                  Nenhum {tab === "agents" ? "perfil manual" : "vínculo manual"}{" "}
                  cadastrado. Os vínculos importados permanecem separados da
                  curadoria.
                </p>
              )}
          </>
        )}
        {message && (
          <div className="admin-message" role="status">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
