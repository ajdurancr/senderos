import { createSenderos } from "@senderos/senderos";

export function senderosForStudio(home = process.env.SENDEROS_HOME) {
  return createSenderos({ home });
}
