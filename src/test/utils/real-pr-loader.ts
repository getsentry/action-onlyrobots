import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { PRExample } from './pr-fetcher';

export class RealPRLoader {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(__dirname, '../datasets/real-prs');
  }

  async loadAllPRs(): Promise<PRExample[]> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const files = await fs.readdir(this.dataDir);
      const allPRs: PRExample[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.dataDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const pr: PRExample = JSON.parse(content);
        allPRs.push(pr);
      }

      return allPRs;
    } catch {
      console.error('Error loading PRs');
      return [];
    }
  }
}
