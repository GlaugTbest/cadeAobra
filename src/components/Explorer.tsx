"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Info,
  X,
  Share2,
  Search as SearchIcon,
  Building2,
  ExternalLink,
  LocateFixed,
} from "lucide-react";
import Search from "./Search";
import { WorkIcon } from "./WorkVisual";
import WorkDetail, { type Detail } from "./WorkDetail";
import {
  date,
  money,
  statusClass,
  type Municipality,
  type Agent,
  type Snapshot,
} from "@/lib/domain";
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="map-surface map-loading">Carregando mapa…</div>
  ),
});
type Summary = {
  id: string;
  name: string;
  status: string;
  category: string;
  planned: number | null;
  municipalityIds: string[];
  hasLocation: boolean;
  roles: string[];
};
type Listing = {
  items: Summary[];
  page: number;
  pages: number;
  totals: { count: number; planned: number; known: number };
  counts: Record<string, number>;
  statuses: string[];
  categories: string[];
  municipality: Municipality | null;
  agent: Agent | null;
  roles: string[];
  points: {
    lng: number;
    lat: number;
    id: string;
    name: string;
    status: string;
  }[];
  metadata: {
    version: string;
    consultedAt: string;
    sourceUpdatedAt: string | null;
    coverage: Snapshot["coverage"];
    curationAvailable: boolean;
  };
};
export default function Explorer() {
  const [params, setParams] = useState<URLSearchParams>(new URLSearchParams()),
    [towns, setTowns] = useState<Municipality[]>([]),
    [listing, setListing] = useState<Listing | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [detailLoading, setDetailLoading] = useState(false),
    [tab, setTab] = useState<"works" | "cities">("works"),
    [collapsed, setCollapsed] = useState(false),
    [about, setAbout] = useState(false),
    [toast, setToast] = useState("");
  const panel = useRef<HTMLDivElement>(null),
    initialized = useRef(false),
    scrollPositions = useRef(new globalThis.Map<string, number>());
  const city = params.get("municipio") || "",
    work = params.get("obra") || "",
    agent = params.get("agente") || "";
  const navigate = useCallback(
    (patch: Record<string, string>, replace = false) => {
      const previous = new URLSearchParams(window.location.search),
        p = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        if (value) p.set(key, value);
        else p.delete(key);
      }
      if (
        patch.municipio !== undefined &&
        patch.municipio !== previous.get("municipio")
      )
        p.delete("mapa");
      if (
        ["municipio", "situacao", "categoria", "agente", "papel"].some(
          (k) =>
            patch[k] !== undefined &&
            patch[k] !== String(previous.get(k) || ""),
        ) &&
        !("pagina" in patch)
      )
        p.delete("pagina");
      window.history[replace ? "replaceState" : "pushState"](
        null,
        "",
        "/?" + p.toString(),
      );
      setParams(p);
      setCollapsed(false);
    },
    [],
  );
  useEffect(() => {
    initialized.current = true;
    setCollapsed(window.innerWidth < 700);
    setParams(new URLSearchParams(window.location.search));
    fetch("/data/municipalities.json")
      .then((r) => r.json())
      .then(setTowns)
      .catch(() =>
        setError(
          "Não foi possível carregar os municípios. Recarregue a página.",
        ),
      );
    const pop = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const query = new URLSearchParams(
    [...params].filter(([k]) => !["mapa", "obra"].includes(k)),
  ).toString();
  useEffect(() => {
    if (!initialized.current) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/public?" + query, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error((await r.json()).error);
        return r.json();
      })
      .then(setListing)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Não foi possível carregar os dados.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);
  useEffect(() => {
    if (!work && !loading) {
      const frame = requestAnimationFrame(() =>
        panel.current?.scrollTo(0, scrollPositions.current.get(query) || 0),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [work, query, listing, loading]);
  useEffect(() => {
    setDetail(null);
    if (!work) return;
    const controller = new AbortController();
    setDetailLoading(true);
    fetch("/api/public?obra=" + encodeURIComponent(work), {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error((await r.json()).error);
        return r.json();
      })
      .then((d: Detail) => {
        setDetail(d);
        panel.current?.scrollTo(0, 0);
        if (!city && d.municipalities.length)
          navigate({ municipio: d.municipalities[0].id, obra: work }, true);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [work, city, navigate]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!about) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = [
        ...document.querySelectorAll<HTMLElement>(
          ".about-panel button,.about-panel a",
        ),
      ];
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [about]);
  useEffect(() => {
    const focus = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
      }
    };
    document.addEventListener("keydown", focus);
    return () => document.removeEventListener("keydown", focus);
  }, []);
  const chooseCity = useCallback(
    (id: string) => {
      navigate({ municipio: id, obra: "", agente: "", papel: "" });
      setTab("works");
    },
    [navigate],
  );
  const chooseWork = useCallback(
    (id: string) => navigate({ obra: id }),
    [navigate],
  );
  const chooseAgent = useCallback(
    (id: string) => navigate({ agente: id, obra: "", papel: "" }),
    [navigate],
  );
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link copiado. Você pode compartilhar esta consulta.");
    } catch {
      setToast("Copie o endereço da página para compartilhar.");
    }
  }
  const name =
    listing?.municipality?.name ||
    towns.find((t) => t.id === city)?.name ||
    "Piauí";
  const filtered = Boolean(
    params.get("situacao") || params.get("categoria") || params.get("papel"),
  );
  const stale = listing
    ? Date.now() - Date.parse(listing.metadata.consultedAt) > 3 * 86400000
    : false;
  return (
    <main className="app">
      <a className="skip-link" href="#resultados">
        Ir para a lista de obras
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cadê a Obra? início">
          <span className="brand-mark">
            <MapPin size={23} strokeWidth={1.7} />
          </span>
          <span>
            cadê a <strong>obra?</strong>
          </span>
        </a>
        <div className="topbar-nav">
          <span className="nav-active">Explorar o mapa</span>
          <button onClick={() => setAbout(true)}>
            Sobre os dados <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="state-label">
          <i />
          Piauí <span>·</span> Transparência pública
        </div>
        <a className="admin-nav" href="/admin">
          Administração <ArrowUpRight size={14} />
        </a>
      </header>
      <div className={"workspace " + (collapsed ? "panel-collapsed" : "")}>
        <section className="map-region" aria-label="Explorar mapa">
          <Map
            city={city}
            work={work}
            camera={params.get("mapa") || ""}
            counts={listing?.counts || {}}
            points={listing?.points || []}
            onCity={chooseCity}
            onWork={chooseWork}
          />
        </section>
        <div className="search-position">
          <Search
            towns={towns}
            onSelect={(r) => {
              if (r.kind === "municipio") chooseCity(r.id);
              else if (r.kind === "agente") {
                navigate({ agente: r.id, obra: "", municipio: "", papel: "" });
              } else
                navigate({
                  obra: r.id,
                  ...(r.municipalityIds?.[0]
                    ? { municipio: r.municipalityIds[0] }
                    : {}),
                });
            }}
          />
        </div>
        <aside
          className={"side-panel " + (collapsed ? "collapsed" : "")}
          aria-label="Resultados e detalhes"
        >
          <button
            className="mobile-handle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            <span>
              {collapsed
                ? `${listing?.totals.count.toLocaleString("pt-BR") ?? "…"} obras · ver lista`
                : "Recolher painel"}
            </span>
          </button>
          <div
            className="panel-scroll"
            id="resultados"
            tabIndex={-1}
            ref={panel}
            onScroll={(e) => {
              if (!work && !loading)
                scrollPositions.current.set(query, e.currentTarget.scrollTop);
            }}
          >
            {error && (
              <div className="error-state" role="alert">
                <Info size={18} />
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
              </div>
            )}
            {work ? (
              detailLoading ? (
                <div className="loading-state">Consultando ficha da obra…</div>
              ) : detail ? (
                <WorkDetail
                  detail={detail}
                  onBack={() => navigate({ obra: "" })}
                  onAgent={chooseAgent}
                  onShare={share}
                />
              ) : (
                !error && <p className="loading-state">Carregando ficha…</p>
              )
            ) : (
              <>
                <div className="panel-breadcrumb">
                  <button
                    onClick={() =>
                      navigate({
                        municipio: "",
                        obra: "",
                        agente: "",
                        situacao: "",
                        categoria: "",
                        papel: "",
                        mapa: "",
                      })
                    }
                  >
                    Piauí
                  </button>
                  {city && (
                    <>
                      <ChevronRight size={13} />
                      <span>{name}</span>
                    </>
                  )}
                  {agent && (
                    <>
                      <ChevronRight size={13} />
                      <span>Perfil</span>
                    </>
                  )}
                  <button
                    className="share-button"
                    aria-label="Compartilhar consulta"
                    onClick={share}
                  >
                    <Share2 size={15} />
                  </button>
                </div>
                {agent ? (
                  <div className="profile-intro">
                    <button
                      className="text-button"
                      onClick={() => navigate({ agente: "", papel: "" })}
                    >
                      <ArrowLeft size={14} />
                      Voltar ao mapa
                    </button>
                    <div className="profile-avatar">
                      {listing?.agent?.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((s) => s[0])
                        .join("") || "…"}
                    </div>
                    <h1>
                      {loading
                        ? "Carregando perfil…"
                        : listing?.agent?.name || "Perfil não encontrado"}
                    </h1>
                    <p>
                      {listing?.agent?.type === "person"
                        ? "Pessoa · perfil documentado"
                        : "Organização · dados institucionais"}
                    </p>
                    {listing?.agent?.identifier && (
                      <p className="record-id">
                        Identificador público: {listing.agent.identifier}
                      </p>
                    )}
                    {listing?.agent?.description && (
                      <p>{listing.agent.description}</p>
                    )}
                    <p className="quiet-note">
                      Empreendimentos relacionados por papéis documentados. Os
                      valores pertencem às obras; não são recursos pessoais do
                      agente.
                    </p>
                  </div>
                ) : (
                  <div className="panel-intro">
                    <h1>
                      {name}
                      <span className="uf-tag">PI</span>
                    </h1>
                    <p>
                      {city
                        ? "Obras públicas no seu município."
                        : "O dinheiro é público. O acompanhamento também."}
                    </p>
                  </div>
                )}
                <div
                  className={"summary " + (loading ? "is-loading" : "")}
                  aria-live="polite"
                >
                  <div>
                    <strong>
                      {listing?.totals.count.toLocaleString("pt-BR") ?? "—"}
                    </strong>
                    <span>obras no recorte</span>
                  </div>
                  <div>
                    <strong>
                      {listing && listing.totals.known
                        ? money(listing.totals.planned, true)
                        : "Não informado"}
                    </strong>
                    <span>investimento previsto</span>
                  </div>
                </div>
                <p className="summary-note">
                  {listing?.totals.known.toLocaleString("pt-BR") ?? "—"} obras
                  com valor informado. Previsão não é pagamento.
                  {city
                    ? " Valores de obras relacionadas, inclusive as que atendem outras cidades."
                    : ""}
                </p>
                <div className="filters-title">
                  <span>
                    <SlidersHorizontal size={14} />
                    Refine sua consulta
                  </span>
                  {filtered && (
                    <button
                      onClick={() =>
                        navigate({ situacao: "", categoria: "", papel: "" })
                      }
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="filters">
                  <label>
                    Situação oficial
                    <select
                      value={params.get("situacao") || ""}
                      onChange={(e) => navigate({ situacao: e.target.value })}
                    >
                      <option value="">Todas as situações</option>
                      {listing?.statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Categoria
                    <select
                      value={params.get("categoria") || ""}
                      onChange={(e) => navigate({ categoria: e.target.value })}
                    >
                      <option value="">Todas as categorias</option>
                      {listing?.categories.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  {agent && (
                    <label className="full-width">
                      Papel documentado
                      <select
                        value={params.get("papel") || ""}
                        onChange={(e) => navigate({ papel: e.target.value })}
                      >
                        <option value="">Todos os papéis</option>
                        {listing?.roles.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div
                  className="list-tabs"
                  role="tablist"
                  aria-label="Exibição de resultados"
                >
                  <button
                    role="tab"
                    aria-selected={tab === "works"}
                    className={tab === "works" ? "active" : ""}
                    onClick={() => setTab("works")}
                  >
                    Obras{" "}
                    <span>{listing?.totals.count.toLocaleString("pt-BR")}</span>
                  </button>
                  {!agent && (
                    <button
                      role="tab"
                      aria-selected={tab === "cities"}
                      className={tab === "cities" ? "active" : ""}
                      onClick={() => setTab("cities")}
                    >
                      Municípios <span>{towns.length}</span>
                    </button>
                  )}
                </div>
                {loading && (
                  <div
                    className="load-line"
                    aria-label="Atualizando resultados"
                  />
                )}
                {tab === "cities" && !agent ? (
                  <div className="city-list">
                    {towns.map((t) => (
                      <button key={t.id} onClick={() => chooseCity(t.id)}>
                        <span>
                          <MapPin size={15} />
                          {t.name}
                        </span>
                        <span>
                          {listing?.counts[t.id] ?? 0}
                          <ChevronRight size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="work-list">
                    {listing?.items.map((w) => (
                      <button
                        className="work-row"
                        key={w.id}
                        onClick={() => chooseWork(w.id)}
                      >
                        <div className="work-row-meta">
                          <span className={"status " + statusClass(w.status)}>
                            <i />
                            {w.status}
                          </span>
                          <span>{w.category}</span>
                        </div>
                        <div className="work-row-title">
                          <span className="work-row-icon">
                            <WorkIcon
                              name={w.name}
                              category={w.category}
                              size={24}
                            />
                          </span>
                          <h2>{w.name}</h2>
                          <ArrowUpRight size={17} />
                        </div>
                        <div className="work-row-bottom">
                          <span>{money(w.planned, true)}</span>
                          <span>
                            {w.hasLocation ? "Previsto" : "Sem ponto preciso"}
                          </span>
                        </div>
                      </button>
                    ))}
                    {listing && !listing.items.length && !loading && (
                      <div className="empty-state">
                        <SearchIcon size={25} />
                        <h2>Nenhuma obra neste recorte</h2>
                        <p>
                          {city
                            ? "O município está disponível, mas os filtros ou as fontes integradas não retornaram obras."
                            : "Tente outra categoria ou situação."}
                        </p>
                        <button
                          onClick={() =>
                            navigate({ situacao: "", categoria: "", papel: "" })
                          }
                        >
                          Limpar filtros
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {tab === "works" && listing && listing.pages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={listing.page <= 1 || loading}
                      aria-label="Página anterior"
                      onClick={() =>
                        navigate({ pagina: String(listing.page - 1) })
                      }
                    >
                      <ArrowLeft size={17} />
                    </button>
                    <span>
                      {listing.page} de {listing.pages}
                    </span>
                    <button
                      disabled={listing.page >= listing.pages || loading}
                      aria-label="Próxima página"
                      onClick={() =>
                        navigate({ pagina: String(listing.page + 1) })
                      }
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>
                )}
                <div className="panel-source">
                  <span className="source-dot" />
                  Dados oficiais · Obrasgov + IBGE
                  <button
                    onClick={() => setAbout(true)}
                    aria-label="Entender fontes e cobertura"
                  >
                    <Info size={14} />
                  </button>
                  <small>
                    Consulta:{" "}
                    {listing ? date(listing.metadata.consultedAt) : "…"}
                    {stale ? " · base desatualizada" : ""}
                  </small>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
      <footer className="bottom-bar">
        <span>Obras públicas. Informação acessível.</span>
        <span>
          Fontes verificáveis <Check size={12} />
        </span>
        <button onClick={() => setAbout(true)}>Cobertura e metodologia</button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {about && (
        <div className="about-overlay">
          <section
            className="about-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setAbout(false);
            }}
          >
            <button
              className="close-about"
              aria-label="Fechar informações sobre os dados"
              onClick={() => setAbout(false)}
              autoFocus
            >
              <X size={22} />
            </button>
            <h1 id="about-title">
              Dados públicos,
              <br />
              com contexto.
            </h1>
            <p>
              O Cadê a Obra? reúne registros oficiais de empreendimentos que
              atendem o Piauí. A cobertura depende do cadastro nas fontes
              integradas e não representa todas as obras existentes.
            </p>
            <h2>O que está nesta consulta</h2>
            <dl className="metadata-list">
              <div>
                <dt>Municípios oficiais</dt>
                <dd>{listing?.metadata.coverage.municipalities ?? "…"}</dd>
              </div>
              <div>
                <dt>Obras únicas</dt>
                <dd>
                  {listing?.metadata.coverage.works.toLocaleString("pt-BR") ??
                    "…"}
                </dd>
              </div>
              <div>
                <dt>Outra UF principal, atendendo PI</dt>
                <dd>{listing?.metadata.coverage.outsidePrimaryUf ?? "…"}</dd>
              </div>
              <div>
                <dt>Sem ponto validado</dt>
                <dd>{listing?.metadata.coverage.withoutCoordinates ?? "…"}</dd>
              </div>
              <div>
                <dt>Sem município associado</dt>
                <dd>{listing?.metadata.coverage.withoutMunicipality ?? "…"}</dd>
              </div>
            </dl>
            <h2>Como contamos</h2>
            <p>
              Uma obra é contada uma vez no estado, mesmo com vários pontos ou
              municípios. O valor integral de obras compartilhadas não é somado
              de novo ao total estadual. Previsões, contratos, empenhos e
              pagamentos permanecem separados.
            </p>
            <h2>Atualização e ausências</h2>
            <p>
              Última consulta bem-sucedida:{" "}
              {listing ? date(listing.metadata.consultedAt) : "…"}. Atualização
              geral da fonte:{" "}
              {listing ? date(listing.metadata.sourceUpdatedAt) : "…"}. A
              sincronização diária é uma meta, sem informação em tempo real.
              Detalhes são consultados por lotes e indicam quando ainda não
              foram obtidos.
            </p>
            <p>
              Coordenadas são verificadas contra os municípios associados,
              usando malha simplificada. Pontos inconsistentes são omitidos; a
              obra permanece na lista. Nenhum ponto é inventado no centro da
              cidade.
            </p>
            <h2>Vínculos e evidências</h2>
            <p>
              Órgãos mantêm os papéis da fonte. Engenheiros, empresas e agentes
              políticos só recebem vínculos documentados; coincidência de nome
              ou mandato não comprova participação.
            </p>
            <div className="source-links">
              <a
                href="https://api-publica.obrasgov.gestao.gov.br/obras/docs"
                target="_blank"
                rel="noreferrer"
              >
                API Obrasgov <ExternalLink size={14} />
              </a>
              <a
                href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
                target="_blank"
                rel="noreferrer"
              >
                Malhas IBGE <ExternalLink size={14} />
              </a>
              <a href="/data/provenance.json" target="_blank">
                Proveniência da carga <ExternalLink size={14} />
              </a>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
