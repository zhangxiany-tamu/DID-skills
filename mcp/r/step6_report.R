# ============================================================================
# did-mcp — did_report: narrative markdown summary
# ============================================================================
# Walks the R-side object store and stitches a markdown report covering
# whichever steps the session has produced. Order: panel → Step 2 (twfe) →
# Step 3 (estimates, compare) → Step 4 (power) → Step 5 (sensitivity). Each
# block is optional; missing steps are skipped with a note.
#
# Output path is tempdir()/did-mcp-reports/<handle_id>.md. The tool registers
# a `report` handle whose schema carries the on-disk path.
# ============================================================================

# ---- Helpers ----------------------------------------------------------------

md_escape <- function(s) gsub("\\|", "\\\\|", as.character(s))

format_sev_line <- function(label, value_line) {
  paste0("- **", label, "**: ", value_line)
}

# ---- Estimator-disagreement summary ----------------------------------------
# When multiple estimates are in the session, compute agreement diagnostics:
# median ATT, dispersion, sign-flips. This surfaces cases like divorce-laws
# where cs/sa/bjs/did2s cluster negative but staggered returns positive —
# a meaningful divergence the user needs to see.

extract_overall_att <- function(obj) {
  tryCatch({
    if (inherits(obj, "MP") && requireNamespace("did", quietly = TRUE)) {
      ag <- did::aggte(obj, type = "simple")
      as.numeric(ag$overall.att)
    } else if (inherits(obj, "fixest")) {
      ct <- tryCatch(summary(obj, agg = "att")$coeftable, error = function(e) NULL)
      if (!is.null(ct) && "ATT" %in% rownames(ct)) as.numeric(ct["ATT", 1]) else NA_real_
    } else if (inherits(obj, "staggered_combined") && !is.null(obj$simple)) {
      as.numeric(obj$simple$estimate)
    } else if (inherits(obj, "drdid")) {
      as.numeric(obj$ATT)
    } else if (inherits(obj, "did_imputation_result")) {
      # Average the horizon estimates if term/estimate present.
      df <- as.data.frame(obj)
      if ("estimate" %in% names(df)) mean(as.numeric(df$estimate), na.rm = TRUE) else NA_real_
    } else {
      NA_real_
    }
  }, error = function(e) NA_real_)
}

estimator_name_of <- function(obj) {
  if (inherits(obj, "MP")) return("cs")
  if (inherits(obj, "fixest")) return("sa")
  if (inherits(obj, "staggered_combined")) return("staggered")
  if (inherits(obj, "drdid")) return("drdid")
  if (inherits(obj, "did_imputation_result")) return("bjs/did2s")
  paste(class(obj), collapse = "/")
}

render_estimator_agreement <- function(estimate_items) {
  if (length(estimate_items) < 2) return("")
  rows <- lapply(estimate_items, function(it) {
    list(id = it$id, est = estimator_name_of(it$obj), att = extract_overall_att(it$obj))
  })
  atts <- vapply(rows, function(r) r$att, numeric(1))
  finite_atts <- atts[is.finite(atts)]
  if (length(finite_atts) < 2) return("")

  med <- median(finite_atts)
  std <- sd(finite_atts)
  rng <- range(finite_atts)
  n_pos <- sum(finite_atts > 0)
  n_neg <- sum(finite_atts < 0)

  dispersion_flag <- abs(med) > 0 && std > 0.5 * abs(med)
  sign_flip       <- n_pos > 0 && n_neg > 0

  header <- "### Estimator Agreement\n\n"
  tbl <- "| Handle | Estimator | Overall ATT |\n|---|---|---:|\n"
  for (r in rows) {
    tbl <- paste0(tbl, sprintf("| %s | %s | %s |\n",
                               r$id, r$est,
                               if (is.finite(r$att)) sprintf("%.4f", r$att) else "NA"))
  }

  note <- sprintf(
    "\n- median ATT: %.4f\n- std: %.4f\n- range: [%.4f, %.4f]\n- signs: %d positive, %d negative\n",
    med, std, rng[1], rng[2], n_pos, n_neg)
  if (dispersion_flag || sign_flip) {
    note <- paste0(note, "\n> **DISAGREEMENT** — ")
    reasons <- character()
    if (sign_flip) reasons <- c(reasons, "sign flip across estimators")
    if (dispersion_flag) reasons <- c(reasons, sprintf("std %.3f exceeds 50%% of |median| (%.3f)", std, abs(med)))
    note <- paste0(note, paste(reasons, collapse = "; "),
                   ". Inspect per-estimator event-study plots before treating any single ATT as definitive.\n")
  } else {
    note <- paste0(note, "\n> Estimators agree qualitatively (same sign, dispersion <50% of |median|).\n")
  }
  paste0(header, tbl, note, "\n")
}

# ---- Per-object renderers ---------------------------------------------------

render_panel <- function(obj, id) {
  sprintf(
    "### %s (panel)\n- rows: %d\n- columns: %s\n",
    id, nrow(obj), paste(names(obj), collapse = ", ")
  )
}

render_design_profile <- function(obj, id) {
  cohorts <- paste(obj$cohort_dates, collapse = ", ")
  sprintf(
    paste0(
      "### %s (design profile)\n",
      "- timing: %s\n- route: %s\n- n_units: %d, n_periods: %d\n",
      "- n_cohorts: %d (%s)\n- balanced: %s, absorbing: %s\n",
      "- ever-treated: %d, never-treated: %d\n"
    ),
    id, obj$timing, obj$route, obj$n_units, obj$n_periods,
    obj$n_cohorts, if (nzchar(cohorts)) cohorts else "—",
    isTRUE(obj$is_balanced), isTRUE(obj$is_absorbing),
    obj$ever_treated, obj$never_treated
  )
}

render_twfe_diagnostic <- function(obj, id) {
  lines <- sprintf("### %s (TWFE diagnostic)\n", id)
  lines <- paste0(lines, sprintf("- **overall severity**: %s\n", obj$overall_severity))
  if (!is.null(obj$bacon)) {
    lines <- paste0(lines, sprintf(
      "- bacon: forbidden weight = %.1f%% (%s), overall β = %.4f across %d 2×2 pairs\n",
      obj$bacon$forbidden_weight_pct, obj$bacon$severity,
      obj$bacon$overall_estimate, obj$bacon$n_pairs))
  } else {
    lines <- paste0(lines, "- bacon: skipped\n")
  }
  if (!is.null(obj$weights)) {
    lines <- paste0(lines, sprintf(
      "- weights: negative share = %.1f%% (%s), %d positive / %d negative cells, TWFE β = %.4f\n",
      obj$weights$negative_weight_pct, obj$weights$severity,
      obj$weights$n_positive %||% NA_integer_,
      obj$weights$n_negative %||% NA_integer_,
      obj$weights$beta %||% NA_real_))
  } else {
    lines <- paste0(lines, "- weights: skipped\n")
  }
  lines <- paste0(lines, sprintf("- recommendation: %s\n", obj$recommendation))
  lines
}

render_estimate <- function(obj, id, handle_obj) {
  cls <- paste(class(obj), collapse = "/")
  # Best-effort: pull overall ATT and SE without running a full aggte().
  # Each estimator class exposes the summary differently; failures degrade
  # to just the class string rather than failing the whole report.
  summary_line <- tryCatch({
    if (inherits(obj, "MP") && requireNamespace("did", quietly = TRUE)) {
      ag <- did::aggte(obj, type = "simple")
      sprintf("- overall ATT: %.4f (SE %.4f)\n",
              as.numeric(ag$overall.att), as.numeric(ag$overall.se))
    } else if (inherits(obj, "fixest")) {
      ct <- tryCatch(summary(obj, agg = "att")$coeftable, error = function(e) NULL)
      if (!is.null(ct) && "ATT" %in% rownames(ct)) {
        sprintf("- overall ATT: %.4f (SE %.4f)\n",
                as.numeric(ct["ATT", 1]), as.numeric(ct["ATT", 2]))
      } else {
        ""
      }
    } else if (inherits(obj, "staggered_combined") && !is.null(obj$simple)) {
      sprintf("- overall ATT: %.4f (SE %.4f)\n",
              as.numeric(obj$simple$estimate), as.numeric(obj$simple$se))
    } else if (inherits(obj, "drdid")) {
      sprintf("- overall ATT: %.4f (SE %.4f)\n",
              as.numeric(obj$ATT), as.numeric(obj$se))
    } else {
      ""
    }
  }, error = function(e) "")

  sprintf("### %s (estimate, class=%s)\n%s", id, cls, summary_line)
}

render_estimate_envelope <- function(env, id) {
  ov <- env$overall %||% list()
  att <- ov$att %||% NA_real_
  se  <- ov$se  %||% NA_real_
  lb  <- ov$ci_lower %||% NA_real_
  ub  <- ov$ci_upper %||% NA_real_
  md  <- env$metadata %||% list()
  est_name <- md$estimator %||% "?"
  n_obs    <- md$n_obs    %||% NA_integer_
  n_units  <- md$n_units  %||% NA_integer_
  n_coh    <- md$n_cohorts %||% NA_integer_

  lines <- sprintf("### %s (estimate: %s)\n", id, est_name)
  lines <- paste0(lines, sprintf(
    "- overall ATT: %.4f (SE %.4f, 95%% CI [%.4f, %.4f])\n", att, se, lb, ub))
  lines <- paste0(lines, sprintf(
    "- n_obs = %s, n_units = %s, n_cohorts = %s\n",
    format(n_obs), format(n_units), format(n_coh)))

  es <- env$event_study %||% list()
  if (length(es) > 0) {
    et <- vapply(es, function(r) as.integer(r$event_time), integer(1))
    be <- vapply(es, function(r) as.numeric(r$estimate), numeric(1))
    lines <- paste0(lines, sprintf(
      "- event study: %d points, event_time ∈ [%d, %d]\n",
      length(et), min(et), max(et)))
    lines <- paste0(lines, "  - | event_time | estimate |\n    |---:|---:|\n")
    for (i in seq_along(et)) {
      lines <- paste0(lines, sprintf("    | %d | %.4f |\n", et[i], be[i]))
    }
  }
  lines
}

render_power_result <- function(obj, id) {
  lines <- sprintf("### %s (power analysis)\n", id)
  lines <- paste0(lines, sprintf("- reference period: %s, α = %s\n",
                                 format(obj$reference_period), format(obj$alpha)))
  for (s in obj$detectable_slopes) {
    lines <- paste0(lines, sprintf(
      "- detectable slope at power = %.2f: %s\n",
      s$target_power,
      if (is.finite(s$slope)) sprintf("%.4f", s$slope) else "NA"))
  }
  lines
}

render_honest_result <- function(obj, id) {
  m_col <- obj$m_col %||% "Mbar"
  lines <- sprintf("### %s (sensitivity: %s)\n", id, obj$method)
  bd <- obj$breakdown_M
  bd_str <- if (is.finite(bd)) sprintf("%.3f", bd) else "robust to all tested M"
  lines <- paste0(lines, sprintf("- breakdown M: %s\n- n_pre = %d, n_post = %d\n",
                                 bd_str, obj$n_pre, obj$n_post))
  lines <- paste0(lines, sprintf("- robust CIs by %s:\n", m_col))
  lines <- paste0(lines, sprintf("  - | %s | lb | ub |\n    |---:|---:|---:|\n", m_col))
  robust <- as.data.frame(obj$robust)
  for (i in seq_len(nrow(robust))) {
    lines <- paste0(lines, sprintf(
      "    | %s | %.4f | %.4f |\n",
      format(robust[[m_col]][i]), as.numeric(robust$lb[i]), as.numeric(robust$ub[i])))
  }
  lines
}

# ---- Dispatch ---------------------------------------------------------------

dispatch_report <- function(id, params) {
  run_with_capture(id, function() {
    handle_id <- params$handle_id
    if (is.null(handle_id)) stop("report: `handle_id` is required", call. = FALSE)

    include_ids <- unlist(params$include_ids %||% list())
    all_ids <- list_object_ids()
    if (length(include_ids) > 0) {
      all_ids <- intersect(all_ids, include_ids)
    }

    # Classify each stored object by kind so we can render in the canonical
    # Step-1 → 5 order. `handle_types` is an optional params lookup from TS
    # mirroring the session store's handle types; falls back to class
    # inspection when absent.
    handle_types <- params$handle_types %||% list()

    classify <- function(obj, id) {
      ty <- handle_types[[id]]
      if (!is.null(ty)) return(ty)
      if (inherits(obj, "twfe_diagnostic_result")) return("twfe_diagnostic")
      if (inherits(obj, "honest_did_result"))      return("honest_result")
      if (inherits(obj, "power_result"))           return("power_result")
      if (inherits(obj, "staggered_combined") ||
          inherits(obj, "MP") || inherits(obj, "fixest") ||
          inherits(obj, "did_imputation_result") ||
          inherits(obj, "drdid")) return("estimate")
      if (inherits(obj, "plot_file")) return("plot")
      if (is.data.frame(obj)) return("panel")
      if (is.list(obj) && !is.null(obj$route) && !is.null(obj$timing)) {
        return("design_profile")
      }
      if (is.list(obj) && !is.null(obj$betahat) && !is.null(obj$tVec)) {
        return("event_study")
      }
      "unknown"
    }

    # Collect per-id kind + object
    items <- list()
    for (sid in all_ids) {
      if (!has_object(sid)) next
      obj <- get_object(sid)
      items[[sid]] <- list(id = sid, obj = obj, kind = classify(obj, sid))
    }

    # Render in canonical order
    order_ranks <- c(
      panel            = 1L,
      design_profile   = 2L,
      twfe_diagnostic  = 3L,
      estimate         = 4L,
      event_study      = 5L,
      power_result     = 6L,
      honest_result    = 7L,
      plot             = 8L,
      unknown          = 9L
    )
    rank_of <- function(k) {
      v <- order_ranks[[k %||% "unknown"]]
      if (is.null(v)) 9L else as.integer(v)
    }
    order_idx <- order(vapply(items, function(x) rank_of(x$kind), integer(1)),
                       names(items))

    body <- "# DID Analysis Report\n\n"
    body <- paste0(body, sprintf("Generated: %s\n\n", format(Sys.time(), "%Y-%m-%d %H:%M:%S")))
    body <- paste0(body, sprintf("Handles included: %d\n\n---\n\n", length(items)))

    # Group by section for a cleaner structure
    sections <- list(
      panel            = "## Step 1 — Panel and Design\n\n",
      design_profile   = "",
      twfe_diagnostic  = "## Step 2 — TWFE Diagnostics\n\n",
      estimate         = "## Step 3 — Estimates\n\n",
      event_study      = "",
      power_result     = "## Step 4 — Power Analysis\n\n",
      honest_result    = "## Step 5 — Sensitivity\n\n",
      plot             = "## Plots\n\n",
      unknown          = "## Other handles\n\n"
    )
    emitted_headers <- character()
    estimate_items <- Filter(function(x) identical(x$kind, "estimate"), items)
    agreement_block <- render_estimator_agreement(estimate_items)
    for (idx in order_idx) {
      it <- items[[idx]]
      header <- sections[[it$kind]] %||% ""
      if (nzchar(header) && !(it$kind %in% emitted_headers)) {
        body <- paste0(body, header)
        emitted_headers <- c(emitted_headers, it$kind)
        # Inject the estimator-agreement table at the top of Step 3.
        if (identical(it$kind, "estimate") && nzchar(agreement_block)) {
          body <- paste0(body, agreement_block)
        }
      }
      block <- switch(it$kind,
        "panel"            = render_panel(it$obj, it$id),
        "design_profile"   = render_design_profile(it$obj, it$id),
        "twfe_diagnostic"  = render_twfe_diagnostic(it$obj, it$id),
        "power_result"     = render_power_result(it$obj, it$id),
        "honest_result"    = render_honest_result(it$obj, it$id),
        "plot"             = sprintf("### %s (plot)\n- path: %s\n- kind: %s\n",
                                     it$id, it$obj$path, it$obj$kind %||% "?"),
        "event_study"      = sprintf("### %s (event study)\n- tVec length: %d\n- diagonal-fallback: %s (reason: %s)\n",
                                     it$id, length(it$obj$tVec),
                                     isTRUE(it$obj$sigma_is_diagonal_fallback),
                                     it$obj$fallback_reason %||% "NA"),
        "estimate"         = render_estimate(it$obj, it$id, it$obj),
        sprintf("### %s (class=%s)\n", it$id, paste(class(it$obj), collapse = "/"))
      )
      body <- paste0(body, block, "\n")
    }

    # Write to disk
    reports_dir <- file.path(tempdir(), "did-mcp-reports")
    if (!dir.exists(reports_dir)) {
      dir.create(reports_dir, recursive = TRUE, showWarnings = FALSE)
    }
    path <- file.path(reports_dir, paste0(handle_id, ".md"))
    writeLines(body, con = path, useBytes = TRUE)

    report_info <- list(
      path       = path,
      n_handles  = length(items),
      created_at = Sys.time()
    )
    class(report_info) <- c("report", "list")
    store_object(handle_id, report_info)

    list(
      result = list(
        handle    = handle_id,
        path      = path,
        n_handles = length(items),
        preview   = substr(body, 1, 1000)
      ),
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "report",
          rClass    = "report",
          summary   = sprintf("report with %d handle(s): %s", length(items), path),
          sizeBytes = as.numeric(file.info(path)$size %||% 0),
          schema    = list(path = path, n_handles = length(items))
        )
      )
    )
  })
}
