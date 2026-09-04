import { createSenderos } from '@senderos/core';

export function senderosForStudio(home = process.env.SENDEROS_HOME) {
  return createSenderos({ home });
}
