import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function runFeedbackTests() {
  const shell = readFileSync(join(process.cwd(), "src", "components", "workspace-shell.tsx"), "utf8");
  const routePath = join(process.cwd(), "src", "app", "api", "feedback", "route.ts");
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

  assert.match(shell, /feedbackOpen/);
  assert.match(shell, /<Dialog open=\{feedbackOpen\}/);
  assert.match(shell, /apiFetch\("\/api\/feedback"/);
  assert.match(shell, /Sending report…/);
  assert.match(shell, /Report sent to GitHub\./);
  assert.match(shell, /Could not send report\./);
  assert.match(shell, /role="status"/);
  assert.match(shell, /<MessageSquare className="h-4 w-4" \/>[\s\S]*?Report\s*<\/button>/);
  assert.doesNotMatch(shell, /github\.com\/Sijan079\/WorshipFlow\/issues\/new/);
  assert.ok(existsSync(routePath));

  const route = readFileSync(routePath, "utf8");
  assert.match(route, /requireAuthenticatedUser/);
  assert.match(route, /const user = await requireAuthenticatedUser\(\)/);
  assert.match(route, /FeedbackSubmissionSchema/);
  assert.match(route, /process\.env\.GITHUB_TOKEN/);
  assert.match(route, /https:\/\/api\.github\.com\/repos\/Sijan079\/WorshipFlow\/issues/);
  assert.match(route, /labels: \[parsed\.data\.kind\.toLowerCase\(\)\]/);
  assert.match(route, /user\.displayName \|\| user\.email/);
  assert.match(route, /console\.error\("Feedback report is not configured\."/);
  assert.match(route, /console\.error\("GitHub feedback report failed\."/);
  assert.match(route, /githubRequestId: response\.headers\.get\("x-github-request-id"\)/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /FeedbackRateLimit/);
  assert.match(route, /rateLimitResponse/);
  assert.match(schema, /model FeedbackRateLimit/);
  assert.match(schema, /@@unique\(\[userId, scope, windowStart\]\)/);
  assert.doesNotMatch(route, /prisma\.feedbackSubmission\.create/);
}
