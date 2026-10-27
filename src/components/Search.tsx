"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search as SearchIcon,
  MapPin,
  Building2,
  Users,
  X,
} from "lucide-react";
import { fold, type Municipality } from "@/lib/domain";
type Result = {
  id: string;
  name: string;
  kind: "municipio" | "obra" | "agente";
  municipalityIds?: string[];
};
export default function Search({
  towns,
  onSelect,
}: {
  towns: Municipality[];
  onSelect: (r: Result) => void;
}) {
  const [value, setValue] = useState(""),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(-1),
    [remote, setRemote] = useState<Result[]>([]),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const local = towns
    .filter((t) => fold(t.name).includes(fold(value)))
    .slice(0, 8)
    .map((t) => ({ ...t, kind: "municipio" as const }));
  const results = value.trim() ? [...local, ...remote] : [];
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    setRemote([]);
    setFailed(false);
    setLoading(false);
    setIndex(-1);
    if (value.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/public?q=" + encodeURIComponent(value), {
          signal: controller.signal,
        });
        if (!r.ok) throw Error();
        const d = await r.json();
        setRemote([
          ...d.works.map((w: Result) => ({ ...w, kind: "obra" })),
          ...d.agents.map((a: Result) => ({ ...a, kind: "agente" })),
        ]);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);
  function select(r: Result) {
    onSelect(r);
    setValue("");
    setOpen(false);
  }
  return (
    <div className="search" ref={root}>
      <SearchIcon size={19} />
      <input
        aria-label="Buscar município, obra ou agente"
        role="combobox"
        aria-expanded={open && Boolean(value)}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={index >= 0 ? `result-${index}` : undefined}
        value={value}
        placeholder="Busque sua cidade, obra ou agente"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setIndex((n) => Math.min(n + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((n) => Math.max(0, n - 1));
          } else if (e.key === "Enter" && results.length) {
            e.preventDefault();
            select(results[index < 0 ? 0 : index]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {value ? (
        <button aria-label="Limpar busca" onClick={() => setValue("")}>
          <X size={16} />
        </button>
      ) : (
        <kbd>/</kbd>
      )}
      {open && value && (
        <div className="search-results" id="search-results" role="listbox">
          {results.map((r, i) => (
            <button
              key={r.kind + r.id}
              id={`result-${i}`}
              role="option"
              aria-selected={index === i}
              className={index === i ? "chosen" : ""}
              onClick={() => select(r)}
              onMouseEnter={() => setIndex(i)}
            >
              {r.kind === "municipio" ? (
                <MapPin size={16} />
              ) : r.kind === "obra" ? (
                <Building2 size={16} />
              ) : (
                <Users size={16} />
              )}
              <span>
                {r.name}
                <small>
                  {r.kind === "municipio"
                    ? "Município · PI"
                    : r.kind === "obra"
                      ? "Obra pública"
                      : "Agente · perfil publicado"}
                </small>
              </span>
            </button>
          ))}
          {!results.length && (
            <p>
              {loading
                ? "Buscando…"
                : failed
                  ? "Busca de obras indisponível. Tente novamente ou escolha um município."
                  : "Nenhum resultado. Tente outro nome."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
