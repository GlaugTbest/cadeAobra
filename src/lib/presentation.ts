// Preserve the source records; repair only unambiguous display artifacts.
export function displayText(value: string): string {
  return value
    .replace(/[\u0091\u0092]/g, "’")
    .replace(/[\u0093\u0094]/g, '"')
    .replace(/[\u0096\u0097]/g, "–")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayCategory(value: string): string {
  const clean = displayText(value);
  return clean.toLocaleLowerCase("pt-BR") === "defesa civil"
    ? "Defesa Civil"
    : clean;
}

export const mapPalette = {
  background: "#0b171b",
  context: "#20383d",
  selected: "#126f70",
  accent: "#ffc45c",
  border: "#0b242b",
  scale: [
    [0, "#20383d"],
    [1, "#155e68"],
    [5, "#148b87"],
    [20, "#27b5a2"],
    [100, "#83dac1"],
    [500, "#dcf6b9"],
  ] as const,
};

export function mapColor(count: number) {
  const next = mapPalette.scale.findIndex(([stop]) => stop > count);
  if (next < 0) return mapPalette.scale.at(-1)![1];
  if (next === 0) return mapPalette.scale[0][1];
  const [low, from] = mapPalette.scale[next - 1],
    [high, to] = mapPalette.scale[next];
  const ratio = (count - low) / (high - low);
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(from.slice(i, i + 2), 16) * (1 - ratio) +
            parseInt(to.slice(i, i + 2), 16) * ratio,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
