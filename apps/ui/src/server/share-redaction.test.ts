import { describe, expect, it } from "vitest";
import { redactShareText } from "./share-redaction";

describe("redactShareText", () => {
  it("removes credentials, customer identifiers, emails, UUIDs, and SQL blocks", () => {
    const redacted = redactShareText(`
      API_KEY=sk-secret-value-123456
      customer_id=cus_123
      analyst@example.com
      550e8400-e29b-41d4-a716-446655440000
      \`\`\`sql
      select * from raw_customers;
      \`\`\`
    `);

    expect(redacted).not.toContain("sk-secret");
    expect(redacted).not.toContain("cus_123");
    expect(redacted).not.toContain("analyst@example.com");
    expect(redacted).not.toContain("550e8400");
    expect(redacted).not.toContain("raw_customers");
  });
});
