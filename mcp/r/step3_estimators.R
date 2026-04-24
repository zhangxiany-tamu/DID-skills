# ============================================================================
# did-mcp — Step 3 estimator wrappers
# ============================================================================
# One wrapper per estimator, each returning list(r_object = <raw>, std = <env>)
# where <env> is the standardized JSON envelope built via step3_common.R. The
# dispatch layer stores the raw R object under a handle and surfaces <env> as
# the tool result. Never-treated recoding happens here per estimator. All five
# wrappers error early with a helpful message when the required package is
# absent; users are pointed at mcp/r/install_packages.R.
# ============================================================================

# ---- CS: did::att_gt + aggte ------------------------------------------------

est_cs <- function(df, schema, params, handle_id) {
  if (!requireNamespace("did", quietly = TRUE)) {
    stop("CS estimator requires `did` package. Run mcp/r/install_packages.R.", call. = FALSE)
  }

  id_var           <- schema$id_var
  time_var         <- schema$time_var
  treat_timing_var <- schema$treat_timing_var
  outcome_var      <- params$outcome_var

  # Snapshot cohort sizes before coercion so the metadata reflects the real
  # cohort structure, not the recoded sentinel.
  cohort_sizes <- summarize_cohort_sizes(df, treat_timing_var, id_var)
  df <- coerce_never_treated_for_estimator(df, treat_timing_var, "cs")

  xformla <- if (length(params$xformla_vars) > 0) {
    stats::as.formula(paste("~", paste(params$xformla_vars, collapse = " + ")))
  } else {
    stats::as.formula("~1")
  }

  cluster_var <- params$cluster_var
  if (is.null(cluster_var) || !nzchar(cluster_var)) cluster_var <- id_var

  control_group <- params$control_group %||% "notyettreated"
  if (!control_group %in% c("nevertreated", "notyettreated")) {
    stop(sprintf("CS: control_group must be nevertreated or notyettreated (got '%s')", control_group),
         call. = FALSE)
  }

  anticipation <- if (is.null(params$anticipation)) 0L else as.integer(params$anticipation)
  bstrap       <- if (is.null(params$bstrap))       TRUE else isTRUE(params$bstrap)
  cband        <- if (is.null(params$cband))        TRUE else isTRUE(params$cband)

  att_args <- list(
    yname         = outcome_var,
    tname         = time_var,
    idname        = id_var,
    gname         = treat_timing_var,
    data          = df,
    control_group = control_group,
    xformla       = xformla,
    anticipation  = anticipation,
    bstrap        = bstrap,
    cband         = cband,
    clustervars   = cluster_var
  )
  if (!is.null(params$est_method) && nzchar(params$est_method)) {
    att_args$est_method <- params$est_method
  }
  if (!is.null(params$weights_var) && nzchar(params$weights_var)) {
    att_args$weightsname <- params$weights_var
  }

  mp <- do.call(did::att_gt, att_args)
  if (length(mp$group) == 0) {
    stop("CS: no valid (g, t) groups. Check never-treated coding and treatment timing.",
         call. = FALSE)
  }

  aggte_simple_args <- list(mp, type = "simple")
  aggte_dyn_args    <- list(mp, type = "dynamic")
  if (!is.null(params$min_e)) aggte_dyn_args$min_e <- as.integer(params$min_e)
  if (!is.null(params$max_e)) aggte_dyn_args$max_e <- as.integer(params$max_e)

  agg_simple <- do.call(did::aggte, aggte_simple_args)
  agg_dyn    <- do.call(did::aggte, aggte_dyn_args)

  overall <- make_overall(agg_simple$overall.att, agg_simple$overall.se)
  event_study <- make_event_rows(agg_dyn$egt, agg_dyn$att.egt, agg_dyn$se.egt)

  # Store the MP object under the handle so did_extract_event_study can find it.
  store_object(handle_id, mp)

  n_cohorts <- length(cohort_sizes)

  # Which cohorts did did::att_gt actually USE? Anything missing was silently
  # dropped (usually a single-unit cohort).
  used_cohorts <- as.character(sort(unique(mp$group)))
  dropped_cohorts <- setdiff(names(cohort_sizes), used_cohorts)

  small_cohorts <- flag_small_cohorts(cohort_sizes, threshold = 2L)

  reliability_notes <- character()
  # CS-specific: cluster_var was accepted but silently dropped when bstrap=FALSE.
  if (!isTRUE(bstrap)) {
    reliability_notes <- c(reliability_notes,
      "clustered standard errors were requested but ignored — did::att_gt requires bstrap=TRUE for clustering. Re-run with bstrap=true.")
  }
  if (length(dropped_cohorts) > 0) {
    reliability_notes <- c(reliability_notes,
      sprintf("did::att_gt silently dropped cohort(s): %s (likely single-unit cohorts).",
              paste(dropped_cohorts, collapse = ", ")))
  }
  if (length(small_cohorts) > 0) {
    reliability_notes <- c(reliability_notes,
      sprintf("Small cohort(s) (< 2 units) present: %s — estimates for these cohorts are unreliable.",
              paste(vapply(small_cohorts, function(x) x$cohort, character(1)), collapse = ", ")))
  }

  metadata <- list(
    estimator           = "cs",
    n_obs               = nrow(df),
    n_units             = length(unique(df[[id_var]])),
    n_cohorts           = n_cohorts,
    control_group       = control_group,
    cohort_sizes        = cohort_sizes,
    small_cohorts       = small_cohorts,
    dropped_cohorts     = as.list(dropped_cohorts),
    clustering_applied  = isTRUE(bstrap) && !is.null(cluster_var) && nzchar(cluster_var),
    reliability_notes   = as.list(reliability_notes),
    warnings            = list()
  )

  list(
    r_object = mp,
    rClass   = "MP",
    std      = envelope(handle_id, overall, event_study, metadata)
  )
}

# ---- SA: fixest::feols + sunab ---------------------------------------------

est_sa <- function(df, schema, params, handle_id) {
  if (!requireNamespace("fixest", quietly = TRUE)) {
    stop("SA estimator requires `fixest` package. Run mcp/r/install_packages.R.", call. = FALSE)
  }

  id_var           <- schema$id_var
  time_var         <- schema$time_var
  treat_timing_var <- schema$treat_timing_var
  outcome_var      <- params$outcome_var

  cohort_sizes <- summarize_cohort_sizes(df, treat_timing_var, id_var)
  df <- coerce_never_treated_for_estimator(df, treat_timing_var, "sa")

  cluster_var <- params$cluster_var
  if (is.null(cluster_var) || !nzchar(cluster_var)) cluster_var <- id_var

  # Build formula: y ~ sunab(g, t) [+ x1 + x2] | id + t
  # sunab is not in fixest's exported namespace in recent versions, but feols's
  # formula parser resolves it internally via getNamespace("fixest").
  rhs_sunab <- sprintf("sunab(%s, %s)", treat_timing_var, time_var)
  rhs <- rhs_sunab
  if (length(params$xformla_vars) > 0) {
    rhs <- paste(rhs, paste(params$xformla_vars, collapse = " + "), sep = " + ")
  }
  fe <- sprintf("%s + %s", id_var, time_var)
  fml <- stats::as.formula(sprintf("%s ~ %s | %s", outcome_var, rhs, fe))
  cluster_fml <- stats::as.formula(paste("~", cluster_var))

  feols_args <- list(fml = fml, data = df, cluster = cluster_fml)
  if (!is.null(params$weights_var) && nzchar(params$weights_var)) {
    feols_args$weights <- stats::as.formula(paste("~", params$weights_var))
  }

  model <- do.call(fixest::feols, feols_args)

  warnings_vec <- character()

  # T / ncohort ratio heuristic
  g <- df[[treat_timing_var]]
  n_periods <- length(unique(df[[time_var]]))
  n_cohorts <- length(unique(g[is.finite(g) & g > 0]))
  if (n_cohorts > 0 && n_periods / n_cohorts < 3) {
    warnings_vec <- c(warnings_vec,
      sprintf("T/cohort ratio (%.1f) < 3 — SA may be rank-deficient.",
              n_periods / n_cohorts))
  }

  # Event-time coefs: coef(m) and fixest::se(m) are both length-K vectors
  # aggregated to event-time (names like "year::-4", "year::0"). The raw vcov(m)
  # is (K+cohort-terms) × same — mismatched. Use sunab_beta_vcv() when we need
  # a matched event-time VCOV (for the overall SE and for the extractor).
  coefs <- stats::coef(model)
  se_vec <- fixest::se(model)

  nms <- names(coefs)
  event_time_full <- parse_event_times(nms)
  keep <- !is.na(event_time_full)
  coefs <- coefs[keep]; se_vec <- se_vec[keep]
  event_time_full <- event_time_full[keep]

  # Matched event-time VCOV via shared extract_sunab_vcov (step3_common.R).
  # That helper centralizes the HonestDiD:::sunab_beta_vcv private-function
  # dependency and its diag(se^2) fallback, and returns a structured record
  # so the warnings vector can surface the degradation to the caller.
  vcov_info <- extract_sunab_vcov(model, length(coefs))
  V_et <- vcov_info$V
  if (isTRUE(vcov_info$is_fallback)) {
    warnings_vec <- c(warnings_vec,
      sprintf("SA overall SE: %s", vcov_info$message))
  }

  mask <- trim_event_window(event_time_full, params$min_e, params$max_e)
  event_time <- event_time_full[mask]
  estimate   <- as.numeric(coefs[mask])
  se_trim    <- as.numeric(se_vec[mask])
  V_et_trim  <- V_et[mask, mask, drop = FALSE]

  # Overall ATT: summary(model, agg="att")$coeftable has a row named "ATT"
  # (older fixest) or "treated" (some variants). Select by row name rather
  # than position — indexing [1, ] would quietly return the wrong value if
  # summary() ever returns multiple rows or reorders them. Column names are
  # stable across fixest versions ("Estimate", "Std. Error").
  att <- NA_real_
  se_overall <- NA_real_
  agg_att <- tryCatch(summary(model, agg = "att"), error = function(e) NULL)
  if (!is.null(agg_att) && !is.null(agg_att$coeftable)) {
    ct <- agg_att$coeftable
    rn <- rownames(ct)
    cn <- colnames(ct)
    att_row <- if ("ATT" %in% rn) "ATT"
               else if (length(rn) == 1L) rn[1]
               else NULL
    est_col <- intersect(c("Estimate", "estimate"), cn)[1]
    se_col  <- intersect(c("Std. Error", "Std.Error", "std.error"), cn)[1]
    if (!is.null(att_row) && !is.na(est_col) && !is.na(se_col)) {
      att <- as.numeric(ct[att_row, est_col])
      se_overall <- as.numeric(ct[att_row, se_col])
    }
  }
  if (!is.finite(att)) {
    # Fallback: simple average of post-treatment event-time coefs, using the
    # trimmed VCOV for the overall SE.
    post_idx <- which(event_time >= 0)
    if (length(post_idx) > 0) {
      att <- mean(estimate[post_idx])
      V_post <- V_et_trim[post_idx, post_idx, drop = FALSE]
      se_overall <- sqrt(sum(V_post) / (length(post_idx) ^ 2))
    }
  }

  # PSD check on the TRIMMED event-time VCOV. The full VCOV may have a
  # marginally negative eigenvalue at a boundary event time the user
  # already excluded; warning on that would penalize users who narrowed
  # the window specifically to avoid those cells.
  vcov_check <- check_vcov_psd(V_et_trim)
  if (!isTRUE(vcov_check$psd)) {
    warnings_vec <- c(warnings_vec,
      sprintf("Non-PSD VCOV on trimmed event window (min eigenvalue %.2e).",
              vcov_check$min_eig))
  }

  overall <- make_overall(att, se_overall)
  event_study <- make_event_rows(event_time, estimate, se_trim)

  store_object(handle_id, model)

  small_cohorts <- flag_small_cohorts(cohort_sizes, threshold = 2L)
  reliability_notes <- character()
  if (!isTRUE(vcov_check$psd)) {
    reliability_notes <- c(reliability_notes,
      sprintf("VCOV not positive semi-definite (min eigenvalue %.2e); inference may be unreliable.",
              vcov_check$min_eig))
  }
  if (length(small_cohorts) > 0) {
    reliability_notes <- c(reliability_notes,
      sprintf("Small cohort(s) (< 2 units): %s — sunab coefficients for those cohorts will be rank-deficient.",
              paste(vapply(small_cohorts, function(x) x$cohort, character(1)), collapse = ", ")))
  }
  if (n_cohorts > 0 && n_periods / n_cohorts < 3) {
    reliability_notes <- c(reliability_notes,
      sprintf("T/cohort ratio %.1f < 3 — Sun-Abraham design is thin on time variation.",
              n_periods / n_cohorts))
  }

  metadata <- list(
    estimator          = "sa",
    n_obs              = nrow(df),
    n_units            = length(unique(df[[id_var]])),
    n_cohorts          = length(cohort_sizes),
    control_group      = "never_or_last_cohort",
    cohort_sizes       = cohort_sizes,
    small_cohorts      = small_cohorts,
    reliability_notes  = as.list(reliability_notes),
    vcov_psd           = isTRUE(vcov_check$psd),
    warnings           = as.list(warnings_vec)
  )

  list(
    r_object = model,
    rClass   = "fixest",
    std      = envelope(handle_id, overall, event_study, metadata)
  )
}

# ---- BJS: didimputation::did_imputation -------------------------------------

est_bjs <- function(df, schema, params, handle_id) {
  if (!requireNamespace("didimputation", quietly = TRUE)) {
    stop("BJS estimator requires `didimputation` package. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }
  if (!requireNamespace("data.table", quietly = TRUE)) {
    stop("BJS estimator requires `data.table` package.", call. = FALSE)
  }

  id_var           <- schema$id_var
  time_var         <- schema$time_var
  treat_timing_var <- schema$treat_timing_var
  outcome_var      <- params$outcome_var

  # Pre-check balanced panel. panel_is_balanced() lives in step3_common.R and
  # is silent (no cat()) so the BJS path does not leak step1's diagnostic
  # output into RpcResponse.stdout.
  if (!panel_is_balanced(df, id_var, time_var)) {
    stop("BJS requires a balanced panel. Balance first, or use CS / SA / did2s.", call. = FALSE)
  }

  cohort_sizes <- summarize_cohort_sizes(df, treat_timing_var, id_var)
  df <- coerce_never_treated_for_estimator(df, treat_timing_var, "bjs")

  dt <- data.table::as.data.table(df)
  dt[[id_var]]           <- as.integer(dt[[id_var]])
  dt[[time_var]]         <- as.integer(dt[[time_var]])
  dt[[treat_timing_var]] <- as.numeric(dt[[treat_timing_var]])
  dt[[outcome_var]]      <- as.numeric(dt[[outcome_var]])

  # Build pretrends vector from min_e (if requested) down to -1
  pretrends_arg <- TRUE
  if (!is.null(params$min_e)) {
    me <- as.integer(params$min_e)
    if (me < 0) pretrends_arg <- seq.int(me, -1L)
  }

  di_args <- list(
    data     = dt,
    yname    = outcome_var,
    gname    = treat_timing_var,
    tname    = time_var,
    idname   = id_var,
    horizon  = TRUE,
    pretrends = pretrends_arg
  )
  if (!is.null(params$cluster_var) && nzchar(params$cluster_var)) {
    di_args$cluster_var <- params$cluster_var
  }
  if (!is.null(params$weights_var) && nzchar(params$weights_var)) {
    di_args$wname <- params$weights_var
  }

  res <- do.call(didimputation::did_imputation, di_args)
  # `did_imputation` returns a data.table/data.frame; tag it so the S3
  # extractor dispatch in step3_extractors.R can find a matching method.
  class(res) <- c("did_imputation_result", class(res))
  resdf <- as.data.frame(res)

  # res has columns term/estimate/std.error; term is "-3", "-2", ..., "0", "1", ...
  # or a grouped term string.
  term <- as.character(resdf$term)
  et <- parse_event_times(term)
  # Drop rows where the term doesn't parse to an integer (e.g. "overall")
  ok <- !is.na(et)
  et <- et[ok]
  estimate <- as.numeric(resdf$estimate[ok])
  se       <- as.numeric(resdf$std.error[ok])

  mask <- trim_event_window(et, params$min_e, params$max_e)
  et <- et[mask]; estimate <- estimate[mask]; se <- se[mask]

  post <- which(et >= 0)
  att <- if (length(post) > 0) mean(estimate[post]) else NA_real_
  se_overall <- if (length(post) > 0) sqrt(mean(se[post]^2) / length(post)) else NA_real_

  overall <- make_overall(att, se_overall)
  event_study <- make_event_rows(et, estimate, se)

  store_object(handle_id, res)

  small_cohorts <- flag_small_cohorts(cohort_sizes, threshold = 2L)
  reliability_notes <- character()
  if (length(small_cohorts) > 0) {
    reliability_notes <- c(reliability_notes,
      sprintf("Small cohort(s) (< 2 units): %s — BJS imputation targets may be noisy for these cohorts.",
              paste(vapply(small_cohorts, function(x) x$cohort, character(1)), collapse = ", ")))
  }

  metadata <- list(
    estimator          = "bjs",
    n_obs              = nrow(df),
    n_units            = length(unique(df[[id_var]])),
    n_cohorts          = length(cohort_sizes),
    control_group      = "notyettreated",
    cohort_sizes       = cohort_sizes,
    small_cohorts      = small_cohorts,
    reliability_notes  = as.list(reliability_notes),
    warnings           = list()
  )

  list(
    r_object = res,
    rClass   = "did_imputation_result",
    std      = envelope(handle_id, overall, event_study, metadata)
  )
}

# ---- Gardner: did2s::did2s -------------------------------------------------

est_did2s <- function(df, schema, params, handle_id) {
  if (!requireNamespace("did2s", quietly = TRUE)) {
    stop("did2s estimator requires `did2s` package. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  id_var           <- schema$id_var
  time_var         <- schema$time_var
  treat_timing_var <- schema$treat_timing_var
  outcome_var      <- params$outcome_var

  cohort_sizes <- summarize_cohort_sizes(df, treat_timing_var, id_var)
  df <- coerce_never_treated_for_estimator(df, treat_timing_var, "did2s")

  # Synthesize binary treat column if needed
  g <- df[[treat_timing_var]]
  t <- df[[time_var]]
  df$.did2s_treat <- as.integer(is.finite(g) & g > 0 & t >= g)

  # Relative time for event-study second stage; extreme times beyond min_e/max_e
  # are mapped to Inf (absorbed into reference).
  df$.did2s_rel <- ifelse(is.finite(g) & g > 0, as.numeric(t) - as.numeric(g), Inf)
  if (!is.null(params$min_e)) {
    df$.did2s_rel[df$.did2s_rel < as.numeric(params$min_e)] <- Inf
  }
  if (!is.null(params$max_e)) {
    df$.did2s_rel[df$.did2s_rel > as.numeric(params$max_e)] <- Inf
  }

  cluster_var <- params$cluster_var
  if (is.null(cluster_var) || !nzchar(cluster_var)) cluster_var <- id_var

  fe <- sprintf("%s + %s", id_var, time_var)
  rhs1 <- if (length(params$xformla_vars) > 0) {
    paste(params$xformla_vars, collapse = " + ")
  } else {
    "0"
  }
  first_stage  <- stats::as.formula(sprintf("~ %s | %s", rhs1, fe))
  second_stage <- stats::as.formula("~ i(.did2s_rel, ref = c(-1, Inf))")

  d2_args <- list(
    data         = df,
    yname        = outcome_var,
    first_stage  = first_stage,
    second_stage = second_stage,
    treatment    = ".did2s_treat",
    cluster_var  = cluster_var
  )
  if (!is.null(params$weights_var) && nzchar(params$weights_var)) {
    d2_args$weights <- params$weights_var
  }

  model <- do.call(did2s::did2s, d2_args)

  coefs <- stats::coef(model)
  V <- stats::vcov(model)
  nms <- names(coefs)
  event_time_all <- parse_event_times(nms)
  keep <- !is.na(event_time_all)
  coefs <- coefs[keep]; nms <- nms[keep]
  if (nrow(as.matrix(V)) == length(keep)) V <- as.matrix(V)[keep, keep, drop = FALSE]
  event_time <- event_time_all[keep]
  se <- sqrt(diag(as.matrix(V)))

  mask <- trim_event_window(event_time, params$min_e, params$max_e)
  event_time <- event_time[mask]
  estimate   <- as.numeric(coefs[mask])
  se_trim    <- as.numeric(se[mask])

  post <- which(event_time >= 0)
  if (length(post) > 0) {
    att <- mean(estimate[post])
    V_post <- as.matrix(V)[mask, mask, drop = FALSE][post, post, drop = FALSE]
    se_overall <- sqrt(sum(V_post) / (length(post) * length(post)))
  } else {
    att <- NA_real_
    se_overall <- NA_real_
  }

  warnings_vec <- character()
  # PSD check on the trimmed VCOV (see est_sa for rationale).
  V_trim <- as.matrix(V)[mask, mask, drop = FALSE]
  vcov_check <- check_vcov_psd(V_trim)
  if (!isTRUE(vcov_check$psd)) {
    warnings_vec <- c(warnings_vec,
      sprintf("Non-PSD VCOV on trimmed event window (min eigenvalue %.2e).",
              vcov_check$min_eig))
  }

  overall <- make_overall(att, se_overall)
  event_study <- make_event_rows(event_time, estimate, se_trim)

  store_object(handle_id, model)

  small_cohorts <- flag_small_cohorts(cohort_sizes, threshold = 2L)
  reliability_notes <- character()
  if (!isTRUE(vcov_check$psd)) {
    reliability_notes <- c(reliability_notes,
      sprintf("VCOV not positive semi-definite (min eigenvalue %.2e); inference may be unreliable.",
              vcov_check$min_eig))
  }
  if (length(small_cohorts) > 0) {
    reliability_notes <- c(reliability_notes,
      sprintf("Small cohort(s) (< 2 units): %s.",
              paste(vapply(small_cohorts, function(x) x$cohort, character(1)), collapse = ", ")))
  }

  metadata <- list(
    estimator          = "did2s",
    n_obs              = nrow(df),
    n_units            = length(unique(df[[id_var]])),
    n_cohorts          = length(cohort_sizes),
    control_group      = "notyettreated",
    cohort_sizes       = cohort_sizes,
    small_cohorts      = small_cohorts,
    reliability_notes  = as.list(reliability_notes),
    vcov_psd           = isTRUE(vcov_check$psd),
    warnings           = as.list(warnings_vec)
  )

  list(
    r_object = model,
    rClass   = "fixest",
    std      = envelope(handle_id, overall, event_study, metadata)
  )
}

# ---- Roth-Sant'Anna: staggered::staggered -----------------------------------

est_staggered <- function(df, schema, params, handle_id) {
  if (!requireNamespace("staggered", quietly = TRUE)) {
    stop("staggered estimator requires `staggered` package. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  if (!is.null(params$weights_var) && nzchar(params$weights_var)) {
    stop("staggered does not support sampling weights. Use CS or did2s instead.", call. = FALSE)
  }

  id_var           <- schema$id_var
  time_var         <- schema$time_var
  treat_timing_var <- schema$treat_timing_var
  outcome_var      <- params$outcome_var

  cohort_sizes <- summarize_cohort_sizes(df, treat_timing_var, id_var)
  df <- coerce_never_treated_for_estimator(df, treat_timing_var, "staggered")

  simple_args <- list(
    df       = df,
    i        = id_var,
    t        = time_var,
    g        = treat_timing_var,
    y        = outcome_var,
    estimand = "simple"
  )
  simple_res <- do.call(staggered::staggered, simple_args)

  # Build event-time vector; default: min:max relative
  g <- df[[treat_timing_var]]
  t <- df[[time_var]]
  finite_g <- g[is.finite(g) & g > 0]
  if (length(finite_g) > 0) {
    max_rel <- as.integer(max(t) - min(finite_g))
    min_rel <- as.integer(min(t) - max(finite_g))
  } else {
    max_rel <- 0L; min_rel <- 0L
  }
  if (!is.null(params$min_e)) min_rel <- max(min_rel, as.integer(params$min_e))
  if (!is.null(params$max_e)) max_rel <- min(max_rel, as.integer(params$max_e))

  # After clamping, the requested window can collapse to min_rel > max_rel when
  # the user's min_e/max_e falls outside the panel's natural event range (e.g.
  # a single-cohort subset where both reduce to 0). seq.int(a, b) with a > b
  # produces a descending sequence which staggered::staggered interprets as
  # nonsense. Detect and skip the eventstudy call with a warning.
  warnings_stag <- character()
  es_res <- NULL
  if (min_rel > max_rel) {
    warnings_stag <- c(warnings_stag, sprintf(
      "staggered: requested event window min_e=%s / max_e=%s yields min_rel (%d) > max_rel (%d) after clamping to the panel's natural range. Event study skipped.",
      format(params$min_e %||% "NULL"), format(params$max_e %||% "NULL"),
      min_rel, max_rel))
  } else {
    es_args <- list(
      df        = df,
      i         = id_var,
      t         = time_var,
      g         = treat_timing_var,
      y         = outcome_var,
      estimand  = "eventstudy",
      eventTime = seq.int(min_rel, max_rel)
    )
    es_res <- tryCatch(do.call(staggered::staggered, es_args), error = function(e) NULL)
  }

  if (is.null(es_res)) {
    event_study <- list()
  } else {
    event_study <- make_event_rows(
      as.integer(es_res$eventTime),
      as.numeric(es_res$estimate),
      as.numeric(es_res$se)
    )
  }

  overall <- make_overall(simple_res$estimate, simple_res$se)

  # Store a wrapper that preserves both results for downstream extract
  combined <- list(simple = simple_res, eventstudy = es_res)
  class(combined) <- c("staggered_combined", "list")
  store_object(handle_id, combined)

  small_cohorts <- flag_small_cohorts(cohort_sizes, threshold = 2L)
  reliability_notes <- character()
  if (length(small_cohorts) > 0) {
    reliability_notes <- c(reliability_notes,
      sprintf("Small cohort(s) (< 2 units): %s.",
              paste(vapply(small_cohorts, function(x) x$cohort, character(1)), collapse = ", ")))
  }

  metadata <- list(
    estimator          = "staggered",
    n_obs              = nrow(df),
    n_units            = length(unique(df[[id_var]])),
    n_cohorts          = length(cohort_sizes),
    control_group      = "notyettreated",
    cohort_sizes       = cohort_sizes,
    small_cohorts      = small_cohorts,
    reliability_notes  = as.list(reliability_notes),
    warnings           = as.list(warnings_stag)
  )

  list(
    r_object = combined,
    rClass   = "staggered_combined",
    std      = envelope(handle_id, overall, event_study, metadata)
  )
}

# ---- Dispatch router --------------------------------------------------------

run_estimator <- function(estimator, df, schema, params, handle_id) {
  switch(estimator,
    "cs"        = est_cs(df, schema, params, handle_id),
    "sa"        = est_sa(df, schema, params, handle_id),
    "bjs"       = est_bjs(df, schema, params, handle_id),
    "did2s"     = est_did2s(df, schema, params, handle_id),
    "staggered" = est_staggered(df, schema, params, handle_id),
    stop(sprintf("Unknown estimator '%s' (expected cs / sa / bjs / did2s / staggered)",
                 estimator), call. = FALSE)
  )
}
