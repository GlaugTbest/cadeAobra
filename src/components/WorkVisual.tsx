import {
  Building2,
  Construction,
  Droplets,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Route,
  Trees,
  Volleyball,
} from "lucide-react";

export function WorkIcon({
  name = "",
  category = "",
  size = 22,
}: {
  name?: string;
  category?: string;
  size?: number;
}) {
  const text = (name + " " + category)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const Icon = /agua|abastecimento|sanea|esgoto|sanitari|hidric/.test(text)
    ? Droplets
    : /estrada|rodovia|pavimenta|vicina|mobilidade/.test(text)
      ? Route
      : /escola|creche|educacao|ensino/.test(text)
        ? GraduationCap
        : /saude|hospital|ubs|medic/.test(text)
          ? HeartPulse
          : /esport|quadra|campo society/.test(text)
            ? Volleyball
            : /habitac|moradia/.test(text)
              ? House
              : /ambiente|parque|florest/.test(text)
                ? Trees
                : /cultura|patrimonio/.test(text)
                  ? Landmark
                  : /administrativo/.test(text)
                    ? Building2
                    : Construction;
  return <Icon size={size} aria-hidden="true" strokeWidth={1.7} />;
}

export function WorkVisual({
  name,
  category,
  hasLocation,
}: {
  name: string;
  category: string;
  hasLocation: boolean;
}) {
  return (
    <div className="work-visual">
      <div className="work-visual-symbol">
        <WorkIcon name={name} category={category} size={40} />
      </div>
      <div>
        <strong>{category}</strong>
        <span>
          {hasLocation
            ? "Localização disponível no mapa"
            : "Sem localização precisa"}
        </span>
      </div>
    </div>
  );
}
