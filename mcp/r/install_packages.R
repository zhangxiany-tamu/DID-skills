#!/usr/bin/env Rscript

# ============================================================================
# did-mcp — R Package Installer
# ============================================================================
# Installs the R packages used by the DID analysis workflow.
# Package set is derived from ../../skill/METHOD_MATRIX.md:
#   - P0 (first-class): install eagerly; workflows depend on these
#   - P1 (caveated):    install on best-effort; workflows use them when present
#   - GitHub-only:      installed via remotes if CRAN not available
#
# Usage:
#   Rscript mcp/r/install_packages.R
# ============================================================================

cat("========================================\n")
cat("  did-mcp R Package Installer\n")
cat("========================================\n\n")

CRAN_REPO <- "https://cloud.r-project.org/"

check_and_install <- function(pkg, tier = "P0", description = "") {
  if (requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("[OK]    %-22s  %s\n", pkg,
                sprintf("already installed (v%s)", packageVersion(pkg))))
    return(invisible(TRUE))
  }
  cat(sprintf("[INST]  %-22s  %s (%s) — %s\n",
              pkg, "installing...", tier, description))
  ok <- tryCatch({
    # Install only structurally required deps (Depends / Imports / LinkingTo).
    # `dependencies = TRUE` also pulls in Suggests, which for tidyverse-family
    # packages roughly doubles install time and disk (svglite, ragg, testthat,
    # …) while none of them are needed to run the DiD workflow.
    install.packages(pkg, repos = CRAN_REPO, quiet = TRUE,
                     dependencies = c("Depends", "Imports", "LinkingTo"))
    requireNamespace(pkg, quietly = TRUE)
  }, error = function(e) {
    cat(sprintf("[FAIL]  %-22s  %s\n", pkg, conditionMessage(e)))
    FALSE
  })
  if (ok) cat(sprintf("[OK]    %-22s  installed\n", pkg))
  invisible(ok)
}

check_and_install_github <- function(pkg, repo_slug, tier = "P0", description = "") {
  if (requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("[OK]    %-22s  already installed (v%s)\n", pkg, packageVersion(pkg)))
    return(invisible(TRUE))
  }
  if (!requireNamespace("remotes", quietly = TRUE)) {
    check_and_install("remotes", tier = "P0",
                      description = "GitHub package installer")
  }
  cat(sprintf("[INST]  %-22s  installing from GitHub %s (%s) — %s\n",
              pkg, repo_slug, tier, description))
  ok <- tryCatch({
    remotes::install_github(repo_slug, quiet = TRUE, upgrade = "never")
    requireNamespace(pkg, quietly = TRUE)
  }, error = function(e) {
    cat(sprintf("[FAIL]  %-22s  %s\n", pkg, conditionMessage(e)))
    FALSE
  })
  if (ok) cat(sprintf("[OK]    %-22s  installed\n", pkg))
  invisible(ok)
}

# ---- Bridge dependency (required) -------------------------------------------

cat("-- Bridge dependencies -----------------------------------\n")
check_and_install("jsonlite", tier = "P0", description = "NDJSON protocol")

# ---- P0 first-class packages ------------------------------------------------

cat("\n-- Treatment profiling (P0) ------------------------------\n")
check_and_install("panelView", tier = "P0", description = "Step 1 rollout visualization")

cat("\n-- TWFE diagnostics (P0) ---------------------------------\n")
check_and_install("bacondecomp",     tier = "P0", description = "Goodman-Bacon decomposition")
check_and_install("TwoWayFEWeights", tier = "P0", description = "Negative-weight detection")

cat("\n-- Robust estimators (P0) --------------------------------\n")
check_and_install("did",            tier = "P0", description = "Callaway & Sant'Anna")
check_and_install("fixest",         tier = "P0", description = "Sun & Abraham via sunab()")
check_and_install("did2s",          tier = "P0", description = "Gardner two-stage")
check_and_install("didimputation",  tier = "P0", description = "BJS imputation")
check_and_install("staggered",      tier = "P0", description = "Roth & Sant'Anna efficient")

cat("\n-- Power & sensitivity (P0) ------------------------------\n")
# HonestDiD is CRAN now; pretrends remains GitHub-only as of skill v1.1.0
check_and_install("HonestDiD",      tier = "P0", description = "Rambachan & Roth sensitivity")
check_and_install_github("pretrends", "jonathandroth/pretrends",
                         tier = "P0", description = "Pre-trend power analysis")

# ---- P1 caveated packages ---------------------------------------------------

cat("\n-- Covariate-aware DiD (P1) ------------------------------\n")
check_and_install("DRDID",          tier = "P1", description = "Doubly robust DiD")

cat("\n-- Extended TWFE & heterogeneous designs (P1) ------------\n")
check_and_install("etwfe",          tier = "P1", description = "Wooldridge extended TWFE")
check_and_install("DIDmultiplegt",  tier = "P1", description = "de Chaisemartin & D'Haultfoeuille (legacy)")
check_and_install("DIDmultiplegtDYN", tier = "P1", description = "de Chaisemartin & D'Haultfoeuille (dynamic)")

cat("\n-- Synthetic control hybrids (P1) ------------------------\n")
check_and_install("gsynth",         tier = "P1", description = "Xu generalized synthetic control")
check_and_install_github("synthdid", "synth-inference/synthdid",
                         tier = "P1", description = "Arkhangelsky et al. synthetic DiD")

# ---- Summary ----------------------------------------------------------------

cat("\n========================================\n")
cat("  Installation Summary\n")
cat("========================================\n\n")

p0_packages <- c(
  "jsonlite",
  "panelView",
  "bacondecomp", "TwoWayFEWeights",
  "did", "fixest", "did2s", "didimputation", "staggered",
  "HonestDiD", "pretrends"
)
p1_packages <- c(
  "DRDID", "etwfe", "DIDmultiplegt", "DIDmultiplegtDYN",
  "gsynth", "synthdid"
)

check_installed <- function(pkgs) {
  sapply(pkgs, function(p) requireNamespace(p, quietly = TRUE))
}
p0_status <- check_installed(p0_packages)
p1_status <- check_installed(p1_packages)

cat(sprintf("P0 (first-class): %d / %d installed\n",
            sum(p0_status), length(p0_status)))
cat(sprintf("P1 (caveated):    %d / %d installed\n",
            sum(p1_status), length(p1_status)))

if (all(p0_status)) {
  cat("\n[OK] All P0 packages installed — did-mcp is ready for Phase 1 smoke test.\n")
} else {
  missing <- p0_packages[!p0_status]
  cat(sprintf("\n[WARN] %d P0 package(s) failed to install: %s\n",
              length(missing), paste(missing, collapse = ", ")))
  cat("      did-mcp tools that depend on these will error at call time.\n")
  cat("      See ../../skill/references/did-troubleshooting.md for install fixes.\n")
}

if (!all(p1_status)) {
  missing <- p1_packages[!p1_status]
  cat(sprintf("\n[INFO] P1 packages not installed: %s\n",
              paste(missing, collapse = ", ")))
  cat("       Tools targeting these packages will be unavailable until installed.\n")
}

cat("\n")
