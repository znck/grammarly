export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isError(value: unknown): value is Error {
  return !!value && value instanceof Error;
}
