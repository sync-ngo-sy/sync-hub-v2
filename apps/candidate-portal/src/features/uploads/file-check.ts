interface FileRuleBase {
  mediaTypeByExtension: Record<string, string>;
  wrongType: string;
  empty: string;
}

type FileRules = FileRuleBase &
  ({ maxBytes: number; tooLarge: string } | { maxBytes?: never; tooLarge?: never });

export function fileRules(rules: FileRules) {
  const mediaTypes = [...new Set(Object.values(rules.mediaTypeByExtension))];
  return {
    accept: [...Object.keys(rules.mediaTypeByExtension), ...mediaTypes].join(','),
    rejectionFor(file: File): string | null {
      const dot = file.name.lastIndexOf('.');
      const extension = dot === -1 ? '' : file.name.slice(dot).toLowerCase();
      const declared = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
      if (!(mediaTypes.includes(declared) || extension in rules.mediaTypeByExtension)) {
        return rules.wrongType;
      }
      if (file.size === 0) return rules.empty;
      if (rules.maxBytes !== undefined && file.size > rules.maxBytes) {
        return rules.tooLarge;
      }
      return null;
    },
  };
}
