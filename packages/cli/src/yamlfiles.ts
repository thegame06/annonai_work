import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const listYaml = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.yaml')) out.push(p);
    }
  };
  walk(dir);
  return out;
};
