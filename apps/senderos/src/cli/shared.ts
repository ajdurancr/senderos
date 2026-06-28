import { resolve } from 'node:path';
import { defaultHomePath } from '../config/runtime';

export function resolveHome(optionHome: string | boolean | undefined) {
  return resolve(String(optionHome ?? defaultHomePath()));
}

export function requirePositional(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}
