import { resolve } from 'node:path';
import { defaultHomePath } from '../config/runtime';

export function resolveHome(optionHome: string | boolean | string[] | undefined) {
  return resolve(String(Array.isArray(optionHome) ? optionHome.at(-1) : optionHome ?? defaultHomePath()));
}

export function requirePositional(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

export function optionString(value: string | boolean | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(-1);
  }

  return typeof value === 'string' ? value : undefined;
}

export function optionStrings(value: string | boolean | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}
