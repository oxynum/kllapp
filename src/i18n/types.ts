import type messages from "@/messages/fr.json";

export type IntlMessages = typeof messages;

declare module "next-intl" {
  interface AppConfig {
    Messages: IntlMessages;
  }
}
