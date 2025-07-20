import type { FileToEvaluate, PRContext } from '../../llm-evaluator';

export interface EvalExample {
  name: string;
  input: {
    files: FileToEvaluate[];
    context?: PRContext;
  };
  expected: {
    isAI: boolean;
    tool?: string;
    minConfidence?: number;
  };
}

// Real Claude Code examples from the wild
export const claudeCodeExamples: EvalExample[] = [
  {
    name: 'Claude Code - Cloudflare Workers fix with signature',
    input: {
      files: [
        {
          filename: 'src/lookup.ts',
          patch: `
-import { readFileSync } from 'fs';
-import { join } from 'path';
+import attributesData from '../data/attributes.json';
+import metricsData from '../data/metrics.json';
+import eventsData from '../data/events.json';

export function lookupAttribute(name: string): AttributeInfo | undefined {
-  const data = JSON.parse(readFileSync(join(__dirname, '../data/attributes.json'), 'utf8'));
-  return data[name];
+  return attributesData[name];
}

export function lookupMetric(name: string): MetricInfo | undefined {
-  const data = JSON.parse(readFileSync(join(__dirname, '../data/metrics.json'), 'utf8'));
-  return data[name];
+  return metricsData[name];
}`,
        },
      ],
      context: {
        title: 'fix: bundle OpenTelemetry data at build time for Cloudflare Workers compatibility',
        description: `Fixes deployment error caused by Node.js file system APIs being unavailable in Cloudflare Workers.

## Changes
- Removed filesystem reads at runtime
- Import JSON data directly (bundled by tsdown)
- Updated build process to generate data at build time
- Removed unnecessary postinstall hook`,
        commitMessages: [
          `fix: bundle OpenTelemetry data at build time for Cloudflare Workers compatibility

The lookup module was trying to read JSON files from the filesystem at runtime,
which doesn't work in Cloudflare Workers. This change bundles the JSON data
directly into the JavaScript bundle at build time.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`,
        ],
      },
    },
    expected: { isAI: true, tool: 'Claude Code', minConfidence: 95 },
  },
  {
    name: 'Claude Code - Test migration with perfect structure',
    input: {
      files: [
        {
          filename: 'src/components/__tests__/Button.test.tsx',
          patch: `
-import { shallow } from 'enzyme';
+import { render, screen, fireEvent } from '@testing-library/react';
 import Button from '../Button';

 describe('Button', () => {
-  it('renders children correctly', () => {
-    const wrapper = shallow(<Button>Click me</Button>);
-    expect(wrapper.text()).toBe('Click me');
+  it('renders children correctly', () => {
+    render(<Button>Click me</Button>);
+    expect(screen.getByText('Click me')).toBeInTheDocument();
   });

-  it('calls onClick handler when clicked', () => {
+  it('calls onClick handler when clicked', () => {
     const handleClick = jest.fn();
-    const wrapper = shallow(<Button onClick={handleClick}>Click</Button>);
-    wrapper.simulate('click');
+    render(<Button onClick={handleClick}>Click</Button>);
+    fireEvent.click(screen.getByText('Click'));
     expect(handleClick).toHaveBeenCalledTimes(1);
   });`,
        },
        {
          filename: 'src/components/__tests__/Input.test.tsx',
          patch: `
-import { mount } from 'enzyme';
+import { render, screen, fireEvent } from '@testing-library/react';
 import Input from '../Input';

 describe('Input', () => {
-  it('updates value on change', () => {
-    const wrapper = mount(<Input />);
-    const input = wrapper.find('input');
-    input.simulate('change', { target: { value: 'test' } });
-    expect(input.prop('value')).toBe('test');
+  it('updates value on change', () => {
+    render(<Input />);
+    const input = screen.getByRole('textbox');
+    fireEvent.change(input, { target: { value: 'test' } });
+    expect(input).toHaveValue('test');
   });`,
        },
      ],
      context: {
        title: 'refactor: migrate tests from Enzyme to React Testing Library',
        commitMessages: [
          'refactor: migrate Button tests to React Testing Library',
          'refactor: migrate Input tests to React Testing Library',
          'refactor: remove Enzyme dependencies',
        ],
      },
    },
    expected: { isAI: true, tool: 'Claude Code', minConfidence: 85 },
  },
  {
    name: 'Claude Code - Verbose naming patterns',
    input: {
      files: [
        {
          filename: 'src/services/user.service.ts',
          patch: `
+export interface UserAccountInformationInterface {
+  userIdentificationNumberString: string;
+  userDisplayNameString: string;
+  userEmailAddressString: string;
+  userAccountCreationTimestampDate: Date;
+  userAccountStatusIndicatorEnum: 'active' | 'inactive' | 'suspended';
+  userProfilePictureUrlString?: string;
+}
+
+export class UserAccountManagementService {
+  private userAccountInformationCache: Map<string, UserAccountInformationInterface>;
+
+  constructor(private readonly databaseConnectionService: DatabaseService) {
+    this.userAccountInformationCache = new Map();
+  }
+
+  async retrieveUserAccountInformationByIdentificationNumber(
+    userIdentificationNumberString: string
+  ): Promise<UserAccountInformationInterface | null> {
+    try {
+      const cachedUserAccountInformation = this.userAccountInformationCache.get(
+        userIdentificationNumberString
+      );
+      
+      if (cachedUserAccountInformation) {
+        return cachedUserAccountInformation;
+      }
+
+      const userAccountInformation = await this.databaseConnectionService
+        .getUserAccountByIdentificationNumber(userIdentificationNumberString);
+      
+      if (userAccountInformation) {
+        this.userAccountInformationCache.set(
+          userIdentificationNumberString,
+          userAccountInformation
+        );
+      }
+
+      return userAccountInformation;
+    } catch (error) {
+      console.error('Failed to retrieve user account information:', error);
+      throw new Error('User account information retrieval failed');
+    }
+  }
+}`,
        },
      ],
    },
    expected: { isAI: true, minConfidence: 80 },
  },
];

// Real human code examples
export const humanExamples: EvalExample[] = [
  {
    name: 'Human - Quick CI fix',
    input: {
      files: [
        {
          filename: '.github/workflows/test.yml',
          patch: `
-        uses: actions/setup-node@v3
+        uses: actions/setup-node@v4
         with:
-          node-version: 18
+          node-version: 20`,
        },
      ],
      context: {
        title: 'bump node',
        description: '',
      },
    },
    expected: { isAI: false },
  },
  {
    name: 'Human - Debug code with TODOs',
    input: {
      files: [
        {
          filename: 'src/debug.js',
          patch: `
+// quick hack to debug issue #142
+console.log("=== DEBUG START ===");
+console.log("user data:", userData);
+
+// TODO: remove this before merging!!!
+if (window.DEBUG) {
+  debugger;
+}
+
+var temp = userData; // temporary
+console.log("temp:", temp);
+
+// wtf is happening here???
+if (temp == null || temp == undefined) {
+  console.log("user is null/undefined");
+  return;
+}`,
        },
      ],
    },
    expected: { isAI: false },
  },
  {
    name: 'Human - Messy hotfix',
    input: {
      files: [
        {
          filename: 'api/handler.js',
          patch: `
   if (req.method === 'POST') {
+    // hotfix for prod issue
+    if (!req.body) {
+      console.log('no body!!!');
+      res.status(400).send('bad request');
+      return;
+    }
     processRequest(req.body);
+    
+    // added logging per John's request
+    console.log(new Date(), 'processed:', req.body.id);
   }`,
        },
      ],
      context: {
        title: 'hotfix prod issue',
        commitMessages: ['fix the thing', 'oops forgot logging'],
      },
    },
    expected: { isAI: false },
  },
  {
    name: 'Human - Typo and formatting fixes',
    input: {
      files: [
        {
          filename: 'README.md',
          patch: `
-This project use React and TypeScript.
+This project uses React and TypeScript.

-## Geting Started
+## Getting Started

 1. Clone the repository
-2. Run \`npm instal\`
+2. Run \`npm install\`
 3. Start the development server`,
        },
      ],
      context: {
        title: 'Fix typos in README',
      },
    },
    expected: { isAI: false },
  },
];

// Mixed/ambiguous examples
export const ambiguousExamples: EvalExample[] = [
  {
    name: 'Professional human code',
    input: {
      files: [
        {
          filename: 'src/utils/validation.ts',
          patch: `
+/**
+ * Validates that a string is a valid email address.
+ * @param email - The email address to validate
+ * @returns True if the email is valid, false otherwise
+ */
+export function isValidEmail(email: string): boolean {
+  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
+  return emailRegex.test(email);
+}
+
+/**
+ * Validates that a password meets security requirements.
+ * @param password - The password to validate
+ * @returns True if the password is valid, false otherwise
+ */
+export function isValidPassword(password: string): boolean {
+  return password.length >= 8 &&
+         /[A-Z]/.test(password) &&
+         /[a-z]/.test(password) &&
+         /[0-9]/.test(password);
+}`,
        },
      ],
      context: {
        title: 'feat: add email and password validation utilities',
        description: 'Added validation functions for user registration flow',
      },
    },
    expected: { isAI: false }, // Could be either, but erring on human side
  },
  {
    name: 'AI-assisted but heavily edited',
    input: {
      files: [
        {
          filename: 'src/api/client.ts',
          patch: `
+import axios from 'axios';
+import { API_BASE_URL } from '../config';
+
+export class ApiClient {
+  private token?: string;
+
+  setAuthToken(token: string) {
+    this.token = token;
+  }
+
+  async get<T>(endpoint: string): Promise<T> {
+    // TODO: add retry logic
+    const response = await axios.get(\`\${API_BASE_URL}\${endpoint}\`, {
+      headers: this.token ? { Authorization: \`Bearer \${this.token}\` } : {}
+    });
+    
+    // HACK: backend returns weird format sometimes
+    if (response.data.data) {
+      return response.data.data;
+    }
+    
+    return response.data;
+  }
+  
+  // More methods coming soon...
+}`,
        },
      ],
    },
    expected: { isAI: false }, // Has human touches (TODO, HACK comments)
  },
];

// Other AI tools examples
export const otherAIToolsExamples: EvalExample[] = [
  {
    name: 'Cursor AI - With attribution',
    input: {
      files: [
        {
          filename: 'src/components/DataTable.tsx',
          patch: `
+// Generated with Cursor AI
+import React, { useState, useMemo } from 'react';
+import { ChevronUp, ChevronDown } from 'lucide-react';
+
+interface DataTableProps<T> {
+  data: T[];
+  columns: Column<T>[];
+  onRowClick?: (row: T) => void;
+}
+
+interface Column<T> {
+  key: keyof T;
+  header: string;
+  sortable?: boolean;
+  render?: (value: T[keyof T], row: T) => React.ReactNode;
+}
+
+export function DataTable<T>({ data, columns, onRowClick }: DataTableProps<T>) {
+  const [sortKey, setSortKey] = useState<keyof T | null>(null);
+  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
+
+  const sortedData = useMemo(() => {
+    if (!sortKey) return data;
+    
+    return [...data].sort((a, b) => {
+      const aVal = a[sortKey];
+      const bVal = b[sortKey];
+      
+      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
+      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
+      return 0;
+    });
+  }, [data, sortKey, sortOrder]);
+
+  return (
+    <table className="w-full border-collapse">
+      <thead>
+        <tr>
+          {columns.map((column) => (
+            <th key={String(column.key)} className="text-left p-2 border-b">
+              {column.header}
+            </th>
+          ))}
+        </tr>
+      </thead>
+      <tbody>
+        {sortedData.map((row, idx) => (
+          <tr key={idx} onClick={() => onRowClick?.(row)}>
+            {columns.map((column) => (
+              <td key={String(column.key)} className="p-2 border-b">
+                {column.render ? column.render(row[column.key], row) : String(row[column.key])}
+              </td>
+            ))}
+          </tr>
+        ))}
+      </tbody>
+    </table>
+  );
+}`,
        },
      ],
    },
    expected: { isAI: true, tool: 'Cursor', minConfidence: 95 },
  },
  {
    name: 'GitHub Copilot - Co-authored commit',
    input: {
      files: [
        {
          filename: 'src/utils/array.ts',
          patch: `
+export function chunk<T>(array: T[], size: number): T[][] {
+  const chunks: T[][] = [];
+  for (let i = 0; i < array.length; i += size) {
+    chunks.push(array.slice(i, i + size));
+  }
+  return chunks;
+}
+
+export function flatten<T>(array: T[][]): T[] {
+  return array.reduce((flat, current) => flat.concat(current), []);
+}
+
+export function unique<T>(array: T[]): T[] {
+  return [...new Set(array)];
+}`,
        },
      ],
      context: {
        commitMessages: [
          `feat: add array utility functions

Co-authored-by: Copilot <copilot@github.com>`,
        ],
      },
    },
    expected: { isAI: true, tool: 'GitHub Copilot', minConfidence: 95 },
  },
];

// Combine all datasets
export const allExamples = [
  ...claudeCodeExamples,
  ...humanExamples,
  ...ambiguousExamples,
  ...otherAIToolsExamples,
];
