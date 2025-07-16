export async function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));

  const expectedSignature = `sha256=${arrayBufferToHex(signatureBuffer)}`;
  return signature === expectedSignature;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map((value) => {
    const hexCode = value.toString(16);
    const paddedHexCode = hexCode.padStart(2, '0');
    return paddedHexCode;
  });
  return hexCodes.join('');
}

export interface GitHubConfig {
  GITHUB_TOKEN?: string;
  GITHUB_WEBHOOK_SECRET: string;
}

export class GitHubClient {
  private token?: string;
  private webhookSecret: string;

  constructor(config: GitHubConfig) {
    this.token = config.GITHUB_TOKEN;
    this.webhookSecret = config.GITHUB_WEBHOOK_SECRET;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'action-onlyrobots/1.0',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  async fetchPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<Array<{ filename: string; patch: string }>> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch PR files: ${response.statusText}`);
    }

    const files = (await response.json()) as Array<{
      filename: string;
      status: string;
      patch?: string;
    }>;
    return files
      .filter((file) => file.status !== 'removed' && this.isCodeFile(file.filename))
      .map((file) => ({
        filename: file.filename,
        patch: file.patch || '',
      }))
      .filter((file) => file.patch.length > 0);
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.rb',
      '.go',
      '.rs',
      '.swift',
      '.kt',
      '.scala',
      '.php',
      '.vue',
      '.svelte',
      '.astro',
      '.mjs',
      '.cjs',
      '.json',
      '.yaml',
      '.yml',
    ];

    return codeExtensions.some((ext) => filename.endsWith(ext));
  }

  async verifyWebhookSignature(body: string, signature: string | null): Promise<boolean> {
    return verifyWebhookSignature(body, signature, this.webhookSecret);
  }

  async createCheckRun(
    owner: string,
    repo: string,
    data: {
      name: string;
      head_sha: string;
      status: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
      output?: {
        title: string;
        summary: string;
        text?: string;
      };
    }
  ): Promise<void> {
    if (!this.token) {
      throw new Error('GitHub token is required to create check runs');
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/check-runs`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create check run: ${error}`);
    }
  }
}

export async function fetchPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
  token?: string
): Promise<any[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'no-humans-agent/1.0',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR files: ${response.statusText}`);
  }

  return response.json() as Promise<any[]>;
}

export async function createCheckRun(
  owner: string,
  repo: string,
  data: {
    name: string;
    head_sha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
    output?: {
      title: string;
      summary: string;
      text?: string;
    };
  },
  token: string
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/check-runs`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'no-humans-agent/1.0',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create check run: ${error}`);
  }
}
