import type { Locale, Messages } from "../../i18n";
import { messagesEn } from "./en";
import { messagesDe } from "./de";
import { messagesFr } from "./fr";
import { messagesEs } from "./es";
import { messagesSv } from "./sv";
import { messagesIt } from "./it";
import { messagesPt } from "./pt";

export const MESSAGES: Record<Locale, Messages> = {
  en: messagesEn,
  de: messagesDe,
  fr: messagesFr,
  es: messagesEs,
  sv: messagesSv,
  it: messagesIt,
  pt: messagesPt,
};
