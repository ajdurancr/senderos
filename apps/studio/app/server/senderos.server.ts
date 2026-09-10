import { createSenderos, prepareSharedDatabase } from '@senderos/core';

let databasePreparation: Promise<void> | undefined;

export async function prepareStudioDatabase() {
  databasePreparation ??= prepareSharedDatabase().catch((error) => {
    databasePreparation = undefined;
    throw error;
  });
  await databasePreparation;
}

export function senderosForStudio() {
  return createSenderos();
}
