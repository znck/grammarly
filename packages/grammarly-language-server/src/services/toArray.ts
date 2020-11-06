export function toArray<T>(item?: T | T[]): T[] {
  if (!item)
    return [];
  else if (Array.isArray(item))
    return item;
  else
    return [item];
}
