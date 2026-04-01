import { parseChppDate } from "@/lib/chpp/utils";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

const CENTRAL_EUROPE_TIME_ZONE = "Europe/Berlin";
const centralEuropeTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CENTRAL_EUROPE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const centralEuropeZoneFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CENTRAL_EUROPE_TIME_ZONE,
  timeZoneName: "short",
});

export function formatDate(input: Date | number) {
  const date = input instanceof Date ? input : new Date(input);
  if (!isValidDate(date)) return "";
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatTime(input: Date | number) {
  const date = input instanceof Date ? input : new Date(input);
  if (!isValidDate(date)) return "";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDateTime(input: Date | number) {
  const date = input instanceof Date ? input : new Date(input);
  if (!isValidDate(date)) return "";
  return `${formatDate(date)}, ${formatTime(date)}`;
}

export function formatCentralEuropeTime(input: Date | number) {
  const date = input instanceof Date ? input : new Date(input);
  if (!isValidDate(date)) {
    return { time: "", zoneAbbreviation: "CET", label: "" };
  }
  const time = centralEuropeTimeFormatter.format(date);
  const zoneAbbreviation =
    centralEuropeZoneFormatter
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")
      ?.value.replace(/\s+/g, "") || "CET";

  return {
    time,
    zoneAbbreviation,
    label: `${zoneAbbreviation} ${time}`,
  };
}

export function formatChppDate(dateString?: string) {
  const parsed = parseChppDate(dateString);
  return parsed ? formatDate(parsed) : null;
}

export function formatChppDateTime(dateString?: string) {
  const parsed = parseChppDate(dateString);
  return parsed ? formatDateTime(parsed) : null;
}
