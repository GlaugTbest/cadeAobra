"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  ExternalLink,
  FileText,
  Share2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { WorkVisual } from "./WorkVisual";
import {
  date,
  money,
  statusClass,
  numberOrNull,
  API,
  type Work,
  type Agent,
  type Municipality,
  type Enrichment,
} from "@/lib/domain";
export type Detail = {
  work: Work;
  agents: Agent[];
  municipalities: Municipality[];
  curationAvailable: boolean;
};
export default function WorkDetail({
  detail,
  onBack,
  onAgent,
  onShare,
  enriching = false,
  enrichmentFailed = false,
  onRetry,
}: {
  detail: Detail;
  onBack: () => void;
  onAgent: (id: string) => void;
  onShare: () => void;
  enriching?: boolean;
  enrichmentFailed?: boolean;
  onRetry?: () => void;
}) {
  const [showDescription, setShowDescription] = useState(false);
  const { work: w } = detail;
  const execution = [...w.enrichment.execution.rows].sort((a, b) =>
    String(b.dt_atualizacao_execucao ?? "").localeCompare(
      String(a.dt_atualizacao_execucao ?? ""),
    ),
  )[0];
  const percentage = numberOrNull(execution?.percentual_execucao_fisica);
  return (
    <>
      <div className="panel-breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar às obras
        </button>
        <button aria-label="Compartilhar obra" onClick={onShare}>
          <Share2 size={17} />
        </button>
      </div>
      <div className="detail-intro">
        <span className={"status " + statusClass(w.status)}>
          <i />
          {w.status}
        </span>
        <h1>{w.name}</h1>
        <p className="place-line">
          <MapPin size={14} />
          {detail.municipalities.map((m) => m.name).join(", ") ||
            "Município não associado"}{" "}
          · PI
        </p>
        <span className="record-id">Obrasgov {w.id}</span>
        <div className="detail-summary">
          <div>
            <strong>{money(w.planned, true)}</strong>
            <span>investimento previsto</span>
          </div>
          {percentage !== null && (
            <div>
              <strong>{percentage.toLocaleString("pt-BR")}%</strong>
              <span>execução física informada</span>
            </div>
          )}
        </div>
        <WorkVisual
          name={w.name}
          category={w.category}
          hasLocation={w.locations.length > 0}
        />
      </div>
      <div className="detail-live-note" role="status">
        <RefreshCw size={15} className={enriching ? "is-spinning" : ""} />
        <span>
          {enriching
            ? "Consultando execução e dados financeiros na fonte oficial…"
            : enrichmentFailed
              ? "Não foi possível atualizar os detalhes. A última consulta disponível foi preservada."
              : "Dados oficiais com data de consulta em cada seção."}
        </span>
        {enrichmentFailed && (
          <button onClick={onRetry}>Tentar novamente</button>
        )}
      </div>
      <section className="detail-section">
        <h2>Sobre esta obra</h2>
        {w.description && w.description !== w.name && (
          <>
            <button
              className="description-toggle"
              aria-expanded={showDescription}
              onClick={() => setShowDescription((v) => !v)}
            >
              Descrição da fonte <ChevronDown size={15} />
            </button>
            {showDescription && <p>{w.description}</p>}
          </>
        )}
        <dl className="metadata-list">
          <div>
            <dt>Categoria</dt>
            <dd>{w.category}</dd>
          </div>
          <div>
            <dt>Início previsto</dt>
            <dd>{date(w.start)}</dd>
          </div>
          <div>
            <dt>Término previsto</dt>
            <dd>{date(w.end)}</dd>
          </div>
          <div>
            <dt>Conclusão efetiva</dt>
            <dd>{date(w.actualEnd)}</dd>
          </div>
        </dl>
        <p className="quiet-note">
          Datas previstas e situação são informadas pela fonte. Prazo antigo não
          comprova atraso ou irregularidade.
        </p>
        {!w.locations.length && (
          <p className="location-note">
            <MapPin size={15} />
            {w.locationNote}
          </p>
        )}
      </section>
      <section className="detail-section">
        <h2>Investimento previsto</h2>
        <div className="investment-value">{money(w.planned)}</div>
        <p className="quiet-note">
          Previsão de investimento, conforme o cadastro. Não representa valor
          pago.
        </p>
        <dl className="metadata-list">
          {w.funding.map((f, i) => (
            <div key={i}>
              <dt>{f.name}</dt>
              <dd>{money(f.value)}</dd>
            </div>
          ))}
        </dl>
        {w.municipalityIds.length > 1 && (
          <p className="quiet-note">
            Obra atende vários municípios. O valor é do empreendimento inteiro,
            sem atribuição exclusiva a cada cidade.
          </p>
        )}
      </section>
      <section className="detail-section">
        <h2>Execução física</h2>
        {percentage !== null ? (
          <>
            <div className="progress-label">
              <strong>{percentage.toLocaleString("pt-BR")}%</strong>
              <span>
                Atualização: {date(execution?.dt_atualizacao_execucao ?? null)}
              </span>
            </div>
            <progress
              max="100"
              value={Math.max(0, Math.min(100, percentage))}
              aria-label="Percentual de execução física"
            />
            <EnrichmentState
              value={w.enrichment.execution}
              label="Execução física"
            />
          </>
        ) : (
          <EnrichmentState
            value={w.enrichment.execution}
            label="Execução física"
          />
        )}
        <DetailSource id={w.id} endpoint="execucao-fisica" />
      </section>
      <section className="detail-section">
        <h2>Contratos</h2>
        <EnrichmentState value={w.enrichment.contracts} label="Contratos" />
        {w.enrichment.contracts.rows.map((c, i) => (
          <div className="financial-record" key={i}>
            <strong>
              Contrato {c.numero_contrato || c.id_contrato || "sem número"}
            </strong>
            <p>{c.fornecedor_contrato || "Fornecedor não informado"}</p>
            <dl className="metadata-list">
              <div>
                <dt>Valor global do contrato</dt>
                <dd>{money(numberOrNull(c.valor_global_contrato))}</dd>
              </div>
              <div>
                <dt>Valor utilizado neste projeto</dt>
                <dd>{money(numberOrNull(c.valor_utilizado_pi_contrato))}</dd>
              </div>
              <div>
                <dt>Vigência final</dt>
                <dd>{date(c.vigencia_fim_contrato)}</dd>
              </div>
            </dl>
            {c.link_transparencia?.startsWith("https://") && (
              <a
                className="source-link"
                href={c.link_transparencia}
                target="_blank"
                rel="noreferrer"
              >
                Consultar contrato <ExternalLink size={13} />
              </a>
            )}
          </div>
        ))}
        {w.enrichment.contracts.rows.length > 0 && (
          <p className="quiet-note">
            Um contrato pode abranger outros projetos. Valores globais não são
            somados como gasto desta obra.
          </p>
        )}
        <DetailSource id={w.id} endpoint="contrato" />
      </section>
      <section className="detail-section">
        <h2>Empenhado, liquidado e pago</h2>
        <EnrichmentState value={w.enrichment.commitments} label="Empenhos" />
        {w.enrichment.commitments.rows.map((e, i) => (
          <div className="financial-record" key={i}>
            <strong>Empenho {e.nr_empenho || "sem número"}</strong>
            <p>
              {e.organizacao_empenho || "Órgão não informado"} ·{" "}
              {date(e.data_emissao)}
            </p>
            <dl className="metadata-list">
              {[
                ["Empenhado", "valor_empenho"],
                ["Liquidado", "liquidado"],
                ["Pago no exercício", "pago"],
                ["Restos a pagar inscritos", "rpinscrito"],
                ["Restos a pagar pagos", "rppago"],
              ].map(([name, key]) => (
                <div key={key}>
                  <dt>{name}</dt>
                  <dd>{money(numberOrNull(e[key]))}</dd>
                </div>
              ))}
            </dl>
            {e.codigo_autor_emenda && String(e.codigo_autor_emenda) !== "0" && (
              <p className="quiet-note">
                Código de autor de emenda: {e.codigo_autor_emenda}. Identidade e
                vínculo parlamentar ainda não validados.
              </p>
            )}
          </div>
        ))}
        <p className="quiet-note">
          Categorias e exercícios distintos permanecem separados. Ausência de
          informação não significa valor zero.
        </p>
        <DetailSource id={w.id} endpoint="empenho" />
      </section>
      <section className="detail-section">
        <h2>
          Agentes relacionados{" "}
          <span className="count-label">{detail.agents.length}</span>
        </h2>
        <p className="quiet-note">
          Papéis documentados. “Órgão executor” não significa construtora ou
          responsável técnico.
        </p>
        {w.links.map((l) => {
          const a = detail.agents.find((a) => a.id === l.agentId);
          if (!a) return null;
          return (
            <div className="agent-link" key={l.id}>
              <button onClick={() => onAgent(a.id)}>
                <span className="avatar">
                  {a.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>{l.role}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <div className="link-evidence">
                <span>
                  {l.start || l.end
                    ? `${date(l.start)} a ${date(l.end)}`
                    : "Período não informado"}
                </span>
                {l.source && (
                  <a href={l.source} target="_blank" rel="noreferrer">
                    Fonte <ExternalLink size={11} />
                  </a>
                )}
                {l.evidence && (
                  <div>
                    <strong>{l.evidence.title}</strong>
                    <p>
                      {l.evidence.issuer} · {date(l.evidence.date)}
                    </p>
                    <p>{l.evidence.excerpt}</p>
                    {l.evidence.file_path && l.evidence.id && (
                      <a
                        href={"/api/evidence/" + l.evidence.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Documento publicado
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!w.links.length && <p>Nenhum vínculo publicado.</p>}
        {!detail.curationAvailable && (
          <p className="quiet-note">
            Curadoria manual indisponível nesta consulta. Os vínculos oficiais
            acima continuam disponíveis.
          </p>
        )}
      </section>
      <section className="detail-section">
        <h2>Histórico informado</h2>
        <EnrichmentState value={w.enrichment.history} label="Histórico" />
        {w.enrichment.history.rows.map((h, i) => (
          <p key={i}>
            {date(h.data_historico_situacao_investimento)} ·{" "}
            {h.descricao_historico_situacao_investimento}
            <br />
            {h.justificativa_cancelada_paralisada}
          </p>
        ))}
      </section>
      <section className="detail-section source-section">
        <FileText size={18} />
        <h2>Dados com origem</h2>
        <p>
          Consulta do cadastro: {date(w.consultedAt)}
          <br />
          Cadastro na fonte: {date(w.registeredAt)}
        </p>
        <a
          href={w.source}
          target="_blank"
          rel="noreferrer"
          className="source-link"
        >
          Abrir registro no Obrasgov <ExternalLink size={14} />
        </a>
        <p className="quiet-note">
          A data de consulta é diferente da atualização de cada registro na
          origem.
        </p>
      </section>
    </>
  );
}
function EnrichmentState({
  value,
  label,
}: {
  value: Enrichment;
  label: string;
}) {
  return value.rows.length ? (
    <p className="quiet-note">
      Consulta: {date(value.fetchedAt)}
      {value.state === "error"
        ? " · Nova consulta indisponível; exibindo os últimos dados obtidos."
        : ""}
    </p>
  ) : (
    <p className="quiet-note">
      {value.state === "not_fetched"
        ? `${label}: detalhe ainda não consultado na fonte.`
        : value.state === "error"
          ? `${label}: a fonte não respondeu. Use “Tentar novamente” para consultar os detalhes.`
          : `${label}: não informado na fonte consultada em ${date(value.fetchedAt)}.`}
    </p>
  );
}

function DetailSource({ id, endpoint }: { id: string; endpoint: string }) {
  return (
    <a
      className="source-link detail-source"
      href={`${API}/${endpoint}?id_projeto_investimento=${encodeURIComponent(id)}`}
      target="_blank"
      rel="noreferrer"
    >
      Conferir dados na fonte <ExternalLink size={12} />
    </a>
  );
}
