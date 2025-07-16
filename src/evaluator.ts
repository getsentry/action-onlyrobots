interface CodePattern {
  pattern: RegExp;
  humanScore: number;
  description: string;
}

interface EvaluationResult {
  isHumanLike: boolean;
  confidence: number;
  reasons: string[];
  patterns: string[];
}

const HUMAN_CODE_PATTERNS: CodePattern[] = [
  {
    pattern: /console\.log\s*\(\s*["'](?:test|debug|here|TODO|FIXME)/i,
    humanScore: 0.8,
    description: 'Debug console.log statements',
  },
  {
    pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX|BUG):/i,
    humanScore: 0.7,
    description: 'TODO/FIXME comments',
  },
  {
    pattern: /var\s+\w+\s*=/,
    humanScore: 0.6,
    description: "Using 'var' instead of 'let' or 'const'",
  },
  {
    pattern: /\b(?:foo|bar|baz|test|temp|tmp)\b/,
    humanScore: 0.5,
    description: 'Generic variable names',
  },
  {
    pattern: /\s{2,}$/m,
    humanScore: 0.3,
    description: 'Trailing whitespace',
  },
  {
    pattern: /^\s*\/\/\s*[a-z]/m,
    humanScore: 0.4,
    description: 'Lowercase comment starts',
  },
  {
    pattern: /[^\n]\n{3,}/,
    humanScore: 0.4,
    description: 'Multiple consecutive blank lines',
  },
  {
    pattern: /\bconsole\.\w+\s*\([^)]*\);?\s*\/\//,
    humanScore: 0.6,
    description: 'Commented out console statements',
  },
  {
    pattern: /^\s*debugger;/m,
    humanScore: 0.9,
    description: 'Debugger statements',
  },
  {
    pattern: /\s+\n/g,
    humanScore: 0.3,
    description: 'Trailing spaces before newline',
  },
];

const AI_CODE_PATTERNS: CodePattern[] = [
  {
    pattern: /^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\):\s*\w+/m,
    humanScore: -0.5,
    description: 'Explicit TypeScript return types',
  },
  {
    pattern: /^(?:\/\*\*|\s*\*\s*@)/m,
    humanScore: -0.4,
    description: 'JSDoc comments',
  },
  {
    pattern: /^import\s+type\s+\{/m,
    humanScore: -0.3,
    description: 'TypeScript type imports',
  },
  {
    pattern: /\bconst\s+\w+:\s*\w+(?:<[^>]+>)?\s*=/,
    humanScore: -0.4,
    description: 'Explicit type annotations',
  },
  {
    pattern: /\{\s*\n\s*return\s+[^;]+;\s*\n\s*\}/,
    humanScore: -0.3,
    description: 'Consistent formatting in functions',
  },
  {
    pattern: /^export\s+(?:interface|type)\s+\w+/m,
    humanScore: -0.4,
    description: 'Exported TypeScript types',
  },
];

export function evaluateCode(code: string, _filename: string): EvaluationResult {
  let totalScore = 0;
  const matchedPatterns: string[] = [];
  const reasons: string[] = [];

  // Check human-like patterns
  for (const { pattern, humanScore, description } of HUMAN_CODE_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      totalScore += humanScore * (matches.length > 1 ? Math.min(matches.length, 3) : 1);
      matchedPatterns.push(description);
    }
  }

  // Check AI-like patterns (negative scores)
  for (const { pattern, humanScore, description } of AI_CODE_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      totalScore += humanScore * (matches.length > 1 ? Math.min(matches.length, 3) : 1);
      matchedPatterns.push(`[AI] ${description}`);
    }
  }

  // Additional heuristics
  const lines = code.split('\n');

  // Check for inconsistent indentation
  const indentations = new Set<number>();
  lines.forEach((line) => {
    const match = line.match(/^(\s+)/);
    if (match) {
      indentations.add(match[1].length);
    }
  });

  if (indentations.size > 3) {
    totalScore += 0.5;
    reasons.push('Inconsistent indentation detected');
  }

  // Check for very short or very long lines
  const shortLines = lines.filter((l) => l.trim().length > 0 && l.trim().length < 5).length;
  const longLines = lines.filter((l) => l.length > 120).length;

  if (shortLines > lines.length * 0.1) {
    totalScore += 0.3;
    reasons.push('Many very short lines');
  }

  if (longLines > lines.length * 0.1) {
    totalScore += 0.4;
    reasons.push('Many lines exceed 120 characters');
  }

  // Check comment ratio
  const commentLines = lines.filter((l) => l.trim().startsWith('//')).length;
  const codeLines = lines.filter((l) => l.trim().length > 0).length;
  const commentRatio = commentLines / (codeLines || 1);

  if (commentRatio < 0.05) {
    totalScore += 0.3;
    reasons.push('Very few comments');
  } else if (commentRatio > 0.3) {
    totalScore -= 0.2;
    reasons.push('Well-documented code');
  }

  // Normalize score to confidence percentage
  const confidence = Math.min(Math.max(totalScore / 5, 0), 1) * 100;
  const isHumanLike = confidence > 50;

  if (isHumanLike) {
    reasons.unshift(`Code appears to be human-written (${confidence.toFixed(1)}% confidence)`);
  } else {
    reasons.unshift(
      `Code appears to be AI-generated (${(100 - confidence).toFixed(1)}% confidence)`
    );
  }

  return {
    isHumanLike,
    confidence: isHumanLike ? confidence : 100 - confidence,
    reasons,
    patterns: matchedPatterns,
  };
}
