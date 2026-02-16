export function normalizeArray<T>(input?: T | T[]) {
  if (!input) return [] as T[];
  return Array.isArray(input) ? input : [input];
}

export function parseChppDate(dateInput?: unknown) {
  if (dateInput === null || dateInput === undefined) return null;
  let dateString: string;
  if (typeof dateInput === "string") {
    dateString = dateInput.trim();
  } else if (
    typeof dateInput === "object" &&
    dateInput !== null &&
    "#text" in (dateInput as Record<string, unknown>)
  ) {
    const textValue = (dateInput as Record<string, unknown>)["#text"];
    if (typeof textValue !== "string") return null;
    dateString = textValue.trim();
  } else {
    return null;
  }
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
