"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubClient = void 0;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.fetchPullRequestFiles = fetchPullRequestFiles;
exports.createCheckRun = createCheckRun;
async function verifyWebhookSignature(body, signature, secret) {
    if (!signature)
        return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = `sha256=${arrayBufferToHex(signatureBuffer)}`;
    return signature === expectedSignature;
}
function arrayBufferToHex(buffer) {
    const byteArray = new Uint8Array(buffer);
    const hexCodes = [...byteArray].map((value) => {
        const hexCode = value.toString(16);
        const paddedHexCode = hexCode.padStart(2, '0');
        return paddedHexCode;
    });
    return hexCodes.join('');
}
class GitHubClient {
    constructor(config) {
        this.token = config.GITHUB_TOKEN;
        this.webhookSecret = config.GITHUB_WEBHOOK_SECRET;
    }
    getHeaders() {
        const headers = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'action-onlyrobots/1.0',
        };
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }
    async fetchPullRequestFiles(owner, repo, pullNumber) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`, { headers: this.getHeaders() });
        if (!response.ok) {
            throw new Error(`Failed to fetch PR files: ${response.statusText}`);
        }
        const files = (await response.json());
        return files
            .filter((file) => file.status !== 'removed' && this.isCodeFile(file.filename))
            .map((file) => ({
            filename: file.filename,
            patch: file.patch || '',
        }))
            .filter((file) => file.patch.length > 0);
    }
    isCodeFile(filename) {
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
    async verifyWebhookSignature(body, signature) {
        return verifyWebhookSignature(body, signature, this.webhookSecret);
    }
    async createCheckRun(owner, repo, data) {
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
exports.GitHubClient = GitHubClient;
async function fetchPullRequestFiles(owner, repo, pullNumber, token) {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'no-humans-agent/1.0',
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch PR files: ${response.statusText}`);
    }
    return response.json();
}
async function createCheckRun(owner, repo, data, token) {
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
//# sourceMappingURL=github.js.map