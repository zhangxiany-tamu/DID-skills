# ============================================================================
# did-mcp — Step 5: did_honest_sensitivity
# ============================================================================
# Wraps HonestDiD::createSensitivityResults{,_relativeMagnitudes} +
# constructOriginalCS. Takes a Phase-3 event_study handle (betahat, sigma,
# tVec) and returns robust confidence intervals at each M alongside the
# original (non-robust) CI plus the breakdown M.
#
# Convention: betahat/sigma/tVec exclude the reference period (typically
# t = -1). numPrePeriods = count(tVec < 0); numPostPeriods = count(tVec >= 0).
# Event times must be ordered ascending within the pre and post blocks.
# ============================================================================

# ---- Period split -----------------------------------------------------------

split_event_study_periods <- function(es, reference_period = -1,
                                       max_pre_periods = NULL,
                                       max_post_periods = NULL) {
  tVec <- as.integer(es$tVec)
  # Guard: event-study should not include the reference period — HonestDiD
  # assumes it is already omitted.
  if (reference_period %in% tVec) {
    keep <- tVec != reference_period
    tVec <- tVec[keep]
    es$betahat <- as.numeric(es$betahat)[keep]
    es$sigma   <- as.matrix(es$sigma)[keep, keep, drop = FALSE]
  }

  # HonestDiD expects betahat ordered [pre..., post...] with pre in ascending
  # event time (most-negative first) and post in ascending. Reorder to match.
  ord <- order(tVec)
  tVec <- tVec[ord]
  betahat <- as.numeric(es$betahat)[ord]
  sigma   <- as.matrix(es$sigma)[ord, ord, drop = FALSE]

  # Window cap — HonestDiD's ARP CI scales badly with n_pre. Keep only the
  # `max_pre_periods` most-recent pre periods and the earliest `max_post_periods`
  # post periods by default. `NULL` / non-finite means no cap.
  pre_mask  <- tVec < 0
  post_mask <- tVec >= 0
  n_pre_raw  <- sum(pre_mask)
  n_post_raw <- sum(post_mask)
  dropped_pre  <- integer(0)
  dropped_post <- integer(0)
  if (!is.null(max_pre_periods) && is.finite(max_pre_periods) && n_pre_raw > max_pre_periods) {
    pre_tvec <- tVec[pre_mask]
    # Keep the largest (closest-to-zero) pre event times.
    cutoff <- sort(pre_tvec, decreasing = TRUE)[as.integer(max_pre_periods)]
    keep_pre <- tVec >= cutoff | !pre_mask
    dropped_pre <- tVec[pre_mask & !keep_pre]
    tVec <- tVec[keep_pre]
    betahat <- betahat[keep_pre]
    sigma <- sigma[keep_pre, keep_pre, drop = FALSE]
  }
  if (!is.null(max_post_periods) && is.finite(max_post_periods) && n_post_raw > max_post_periods) {
    post_mask2 <- tVec >= 0
    post_tvec  <- tVec[post_mask2]
    cutoff <- sort(post_tvec, decreasing = FALSE)[as.integer(max_post_periods)]
    keep_post <- tVec <= cutoff | !post_mask2
    dropped_post <- tVec[post_mask2 & !keep_post]
    tVec <- tVec[keep_post]
    betahat <- betahat[keep_post]
    sigma <- sigma[keep_post, keep_post, drop = FALSE]
  }

  pre_idx  <- which(tVec < 0)
  post_idx <- which(tVec >= 0)

  list(
    tVec = tVec,
    betahat = betahat,
    sigma = sigma,
    pre_idx = pre_idx,
    post_idx = post_idx,
    n_pre = length(pre_idx),
    n_post = length(post_idx),
    dropped_pre  = as.integer(dropped_pre),
    dropped_post = as.integer(dropped_post),
    n_pre_raw    = n_pre_raw,
    n_post_raw   = n_post_raw
  )
}

# ---- Breakdown M search -----------------------------------------------------
# Smallest Mbar where the robust CI straddles zero. Results frame is assumed
# sorted by Mbar ascending (HonestDiD convention).

find_breakdown_M <- function(results, m_col = "Mbar") {
  if (!(m_col %in% names(results))) return(NA_real_)
  for (i in seq_len(nrow(results))) {
    lb <- results$lb[i]
    ub <- results$ub[i]
    if (is.finite(lb) && is.finite(ub) && lb <= 0 && ub >= 0) {
      return(as.numeric(results[[m_col]][i]))
    }
  }
  NA_real_  # robust to all tested M
}

# ---- Core runner ------------------------------------------------------------

run_honest_sensitivity <- function(es, params) {
  if (!requireNamespace("HonestDiD", quietly = TRUE)) {
    stop("did_honest_sensitivity requires the `HonestDiD` package. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  method <- params$method %||% "relative_magnitudes"
  if (!method %in% c("relative_magnitudes", "smoothness")) {
    stop(sprintf("did_honest_sensitivity: method must be relative_magnitudes or smoothness (got '%s')", method),
         call. = FALSE)
  }

  reference_period <- as.integer(params$reference_period %||% -1L)
  # Default to a ±5 window so HonestDiD finishes in reasonable time. The ARP
  # CI computation inside createSensitivityResults_relativeMagnitudes scales
  # badly with n_pre (a 10-pre event study costs ~70s per Mbar). Callers can
  # override to NA/NULL to disable the cap.
  max_pre_periods  <- if (is.null(params$max_pre_periods))  5L else suppressWarnings(as.integer(params$max_pre_periods))
  max_post_periods <- if (is.null(params$max_post_periods)) 5L else suppressWarnings(as.integer(params$max_post_periods))
  ps <- split_event_study_periods(
    es,
    reference_period = reference_period,
    max_pre_periods  = max_pre_periods,
    max_post_periods = max_post_periods
  )

  if (ps$n_pre == 0) {
    stop("did_honest_sensitivity: event study has no pre-treatment periods. Cannot run sensitivity.",
         call. = FALSE)
  }
  if (ps$n_post == 0) {
    stop("did_honest_sensitivity: event study has no post-treatment periods. Cannot run sensitivity.",
         call. = FALSE)
  }

  if (length(ps$dropped_pre) > 0 || length(ps$dropped_post) > 0) {
    warning(sprintf(
      "did_honest_sensitivity: trimmed event study to pre=%d, post=%d. Dropped pre event times: [%s]; dropped post: [%s]. Override via max_pre_periods / max_post_periods.",
      ps$n_pre, ps$n_post,
      paste(ps$dropped_pre, collapse = ", "),
      paste(ps$dropped_post, collapse = ", ")),
      call. = FALSE)
  }

  # Real warning() call so run_with_capture() forwards this to the tool's
  # `warnings` output. Accumulating into a local vector and returning it
  # would be silently dropped by the dispatcher.
  if (isTRUE(es$sigma_is_diagonal_fallback)) {
    warning(sprintf(
      "Input event study sigma is diagonal-fallback (reason: %s). HonestDiD results ignore off-diagonal covariance and may be misleading.",
      es$fallback_reason %||% "unknown"), call. = FALSE)
  }

  # Default M grids follow the skill's practitioner defaults.
  if (method == "relative_magnitudes") {
    Mbarvec <- as.numeric(params$Mbarvec %||% seq(0.5, 2, by = 0.5))
    robust <- HonestDiD::createSensitivityResults_relativeMagnitudes(
      betahat        = ps$betahat,
      sigma          = ps$sigma,
      numPrePeriods  = ps$n_pre,
      numPostPeriods = ps$n_post,
      Mbarvec        = Mbarvec
    )
    m_col <- "Mbar"
  } else {
    Mvec <- as.numeric(params$Mvec %||% c(0, 0.01, 0.02, 0.03))
    smooth_method <- params$smoothness_method %||% "FLCI"
    robust <- HonestDiD::createSensitivityResults(
      betahat        = ps$betahat,
      sigma          = ps$sigma,
      numPrePeriods  = ps$n_pre,
      numPostPeriods = ps$n_post,
      method         = smooth_method,
      Mvec           = Mvec
    )
    m_col <- "M"
  }

  original <- HonestDiD::constructOriginalCS(
    betahat        = ps$betahat,
    sigma          = ps$sigma,
    numPrePeriods  = ps$n_pre,
    numPostPeriods = ps$n_post
  )

  breakdown <- find_breakdown_M(as.data.frame(robust), m_col = m_col)

  list(
    robust       = as.data.frame(robust),
    original     = as.list(original),
    breakdown_M  = breakdown,
    m_col        = m_col,
    method       = method,
    ps           = ps
  )
}
