#!/usr/bin/env Rscript
# ============================================================================
# did-mcp — Fixture exporter
# ============================================================================
# Writes the `mpdta` panel (from the `did` package) to
# mcp/test/fixtures/mpdta.csv so the smoke test and vitest unit tests have
# a deterministic CSV to load. Run once whenever the fixture needs refreshing.
#
# Usage:   Rscript mcp/scripts/export-fixtures.R
# ============================================================================

suppressPackageStartupMessages({
  if (!requireNamespace("did", quietly = TRUE)) {
    stop("The `did` package is not installed. Run mcp/r/install_packages.R first.")
  }
  library(did)
})

data(mpdta)

script_dir <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- sub("^--file=", "", args[grepl("^--file=", args)])
  if (length(file_arg) > 0) return(dirname(normalizePath(file_arg[1])))
  getwd()
})()

out_dir <- normalizePath(file.path(script_dir, "..", "test", "fixtures"), mustWork = FALSE)
if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)

out_path <- file.path(out_dir, "mpdta.csv")
write.csv(mpdta, out_path, row.names = FALSE)

cat(sprintf("Wrote %d rows to %s\n", nrow(mpdta), out_path))
cat(sprintf("Columns: %s\n", paste(names(mpdta), collapse = ", ")))
