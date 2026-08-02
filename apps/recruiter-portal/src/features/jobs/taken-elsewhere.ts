/** What the criteria's other rows already hold, so a picker cannot offer the same one twice. */
export function takenElsewhere<Entry>(
  entries: Entry[] | undefined,
  index: number,
  held: (entry: Entry) => string,
): string[] {
  return (entries ?? []).filter((_, at) => at !== index).map(held);
}
