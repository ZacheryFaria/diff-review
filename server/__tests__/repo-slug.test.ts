import { describe, it, expect } from "vitest";
import { repoSlugFromRemote, sanitizeSlug } from "../repo-slug.js";

describe("repoSlugFromRemote", () => {
  it("parses HTTPS github remote", () => {
    expect(repoSlugFromRemote("https://github.com/zfaria/diff-review.git"))
      .toBe("github.com-zfaria-diff-review");
  });

  it("parses SSH github remote", () => {
    expect(repoSlugFromRemote("git@github.com:zfaria/diff-review.git"))
      .toBe("github.com-zfaria-diff-review");
  });

  it("strips .git suffix", () => {
    expect(repoSlugFromRemote("https://github.com/org/repo.git"))
      .toBe("github.com-org-repo");
  });

  it("handles URLs without .git suffix", () => {
    expect(repoSlugFromRemote("https://github.com/org/repo"))
      .toBe("github.com-org-repo");
  });
});

describe("sanitizeSlug", () => {
  it("replaces unsafe characters", () => {
    expect(sanitizeSlug("git@github.com:org/repo")).toBe("git-github.com-org-repo");
  });
});
