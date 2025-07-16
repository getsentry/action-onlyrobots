/**
 * Example feature implementation for testing AI detection
 * This file demonstrates clean, well-structured code typical of AI-generated content
 */

export interface FeatureConfig {
  enabled: boolean;
  maxRetries: number;
  timeout: number;
  apiEndpoint: string;
}

export interface FeatureResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  timestamp: Date;
}

/**
 * Validates feature configuration
 * @param config - The configuration object to validate
 * @returns Validated configuration
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config: unknown): FeatureConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  const cfg = config as Record<string, unknown>;

  // Validate enabled field
  if (typeof cfg.enabled !== 'boolean') {
    throw new Error('Configuration property "enabled" must be a boolean');
  }

  // Validate maxRetries field
  if (typeof cfg.maxRetries !== 'number' || cfg.maxRetries < 0 || cfg.maxRetries > 10) {
    throw new Error('Configuration property "maxRetries" must be a number between 0 and 10');
  }

  // Validate timeout field
  if (typeof cfg.timeout !== 'number' || cfg.timeout < 1000 || cfg.timeout > 60000) {
    throw new Error('Configuration property "timeout" must be a number between 1000 and 60000');
  }

  // Validate apiEndpoint field
  if (typeof cfg.apiEndpoint !== 'string') {
    throw new Error('Configuration property "apiEndpoint" must be a string');
  }

  try {
    new URL(cfg.apiEndpoint);
  } catch {
    throw new Error('Configuration property "apiEndpoint" must be a valid URL');
  }

  return {
    enabled: cfg.enabled,
    maxRetries: cfg.maxRetries,
    timeout: cfg.timeout,
    apiEndpoint: cfg.apiEndpoint,
  };
}

/**
 * Processes feature request with retry logic
 * @param config - Feature configuration
 * @param payload - Request payload
 * @returns Feature result
 */
export async function processFeatureRequest(
  config: FeatureConfig,
  payload: Record<string, unknown>
): Promise<FeatureResult> {
  if (!config.enabled) {
    return {
      success: false,
      error: new Error('Feature is disabled'),
      timestamp: new Date(),
    };
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        config.apiEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        config.timeout
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxRetries) {
        await delay(2 ** attempt * 1000);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    timestamp: new Date(),
  };
}

/**
 * Performs fetch with timeout
 * @param url - Request URL
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds
 * @returns Fetch response
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Delays execution for specified milliseconds
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export all public APIs
export default {
  validateConfig,
  processFeatureRequest,
};
