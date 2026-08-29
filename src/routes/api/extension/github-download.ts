import { createFileRoute } from "@tanstack/react-router";
import { githubDownloadPreflight, handleExtensionGithubDownload } from "@/lib/extension-github-download.server";

export const Route = createFileRoute("/api/extension/github-download")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => githubDownloadPreflight(request),
      POST: ({ request }) => handleExtensionGithubDownload(request),
    },
  },
});
