import { Octokit } from '@octokit/rest';
import type { FileToEvaluate, PRContext } from '../../llm-evaluator';

export interface PRExample {
  id: string;
  url: string;
  repo: string;
  prNumber: number;
  title: string;
  description: string;
  author: string;
  createdAt: string;
  files: FileToEvaluate[];
  context: PRContext;
  metadata: {
    isAI: boolean;
    tool?: string;
    confidence?: number;
    notes?: string;
    addedBy?: string;
    addedAt?: string;
  };
}

export class PRFetcher {
  private octokit: Octokit;

  constructor(githubToken?: string) {
    this.octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN,
    });
  }

  async fetchPR(prUrl: string): Promise<Omit<PRExample, 'metadata'>> {
    // Parse GitHub URL
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) {
      throw new Error('Invalid GitHub PR URL');
    }

    const [, owner, repo, prNumber] = match;
    const prNum = parseInt(prNumber);

    // Fetch PR data
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNum,
    });

    // Fetch files
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNum,
      per_page: 100,
    });

    // Fetch commits
    const { data: commits } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNum,
      per_page: 100,
    });

    // Convert to our format
    const fileChanges: FileToEvaluate[] = files.map((file) => ({
      filename: file.filename,
      patch: file.patch || '',
    }));

    const commitMessages = commits.map((commit) => commit.commit.message);

    return {
      id: `${owner}/${repo}#${prNum}`,
      url: prUrl,
      repo: `${owner}/${repo}`,
      prNumber: prNum,
      title: pr.title,
      description: pr.body || '',
      author: pr.user?.login || 'unknown',
      createdAt: pr.created_at,
      files: fileChanges,
      context: {
        title: pr.title,
        description: pr.body || '',
        commitMessages,
      },
    };
  }

  async fetchMultiplePRs(prUrls: string[]): Promise<Omit<PRExample, 'metadata'>[]> {
    const results = [];
    for (const url of prUrls) {
      try {
        console.log(`Fetching ${url}...`);
        const pr = await this.fetchPR(url);
        results.push(pr);
        // Rate limit consideration
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
      }
    }
    return results;
  }
}

export function sanitizePRForStorage(pr: PRExample): PRExample {
  // Remove large patches to keep file size manageable
  const MAX_PATCH_SIZE = 5000;

  return {
    ...pr,
    files: pr.files.map((file) => ({
      ...file,
      patch:
        file.patch.length > MAX_PATCH_SIZE
          ? `${file.patch.substring(0, MAX_PATCH_SIZE)}\n... (truncated)`
          : file.patch,
    })),
  };
}
