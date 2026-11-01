import { customAlphabet } from 'nanoid';

const generate = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

/** Creates a short, URL-safe unique id with an optional readable prefix. */
export const uid = (prefix = ''): string => prefix + generate();
