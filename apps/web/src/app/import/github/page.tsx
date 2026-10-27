"use client";

import { Suspense } from "react";
import { GitHubImporter } from "./github-importer";

export default function GitHubImportPage() {
  return <Suspense><GitHubImporter /></Suspense>;
}