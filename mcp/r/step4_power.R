# ============================================================================
# did-mcp — Step 4: did_power_analysis
# ============================================================================
# Wraps pretrends::slope_for_power and (optionally) pretrends::pretrends.
#
# slope_for_power answers "what linear pre-trend slope would we detect with
# power P?". It is the primary Step 4 diagnostic: a near-zero pre-trend F-test
# is only meaningful if power against non-trivial slopes is adequate. Given a
# Phase-3 event_study handle (betahat, sigma, tVec), this tool returns the
# slope for each requested targetPower plus optional pretrends() output when
# deltatrue is supplied.
# ============================================================================

run_power_analysis <- function(es, params) {
  if (!requireNamespace("pretrends", quietly = TRUE)) {
    stop("did_power_analysis requires the `pretrends` package. Run mcp/r/install_packages.R.",
         call. = FALSE)
  }

  reference_period <- as.integer(params$reference_period %||% -1L)
  alpha            <- as.numeric(params$alpha %||% 0.05)
  target_powers    <- as.numeric(params$target_powers %||% c(0.5, 0.8))

  tVec    <- as.integer(es$tVec)
  betahat <- as.numeric(es$betahat)
  sigma   <- as.matrix(es$sigma)

  # pretrends expects tVec without the reference period (matches our extractor
  # convention) but with referencePeriod supplied explicitly.
  if (reference_period %in% tVec) {
    keep <- tVec != reference_period
    tVec <- tVec[keep]
    betahat <- betahat[keep]
    sigma <- sigma[keep, keep, drop = FALSE]
  }

  ord <- order(tVec)
  tVec <- tVec[ord]
  betahat <- betahat[ord]
  sigma <- sigma[ord, ord, drop = FALSE]

  # Use real warning() calls — run_with_capture() in bridge.R collects them
  # into RpcResponse.warnings, which the TS tool surfaces as `warnings` in the
  # tool result. An internal warnings_vec would be dropped by the dispatcher.
  if (isTRUE(es$sigma_is_diagonal_fallback)) {
    warning(sprintf(
      "Input event study sigma is diagonal-fallback (reason: %s). Power calculations ignore off-diagonal covariance and may be miscalibrated.",
      es$fallback_reason %||% "unknown"), call. = FALSE)
  }

  # NOTE: current pretrends::slope_for_power has signature
  #   slope_for_power(sigma, targetPower, tVec, referencePeriod, prePeriodIndices)
  # and does NOT accept `alpha` (contrary to some older docs). Don't pass it.
  slopes <- vector("list", length(target_powers))
  for (i in seq_along(target_powers)) {
    tp <- target_powers[i]
    s <- tryCatch(
      pretrends::slope_for_power(
        sigma           = sigma,
        targetPower     = tp,
        tVec            = tVec,
        referencePeriod = reference_period
      ),
      error = function(e) {
        warning(sprintf("slope_for_power failed at power=%.2f: %s",
                        tp, conditionMessage(e)), call. = FALSE)
        NA_real_
      }
    )
    slopes[[i]] <- list(target_power = tp, slope = as.numeric(s))
  }

  pretrends_result <- NULL
  if (!is.null(params$deltatrue)) {
    deltatrue <- as.numeric(params$deltatrue)
    if (length(deltatrue) != length(tVec)) {
      warning(sprintf(
        "deltatrue length (%d) != tVec length (%d); pretrends() skipped.",
        length(deltatrue), length(tVec)), call. = FALSE)
    } else {
      pt <- tryCatch(
        pretrends::pretrends(
          betahat         = betahat,
          sigma           = sigma,
          tVec            = tVec,
          referencePeriod = reference_period,
          deltatrue       = deltatrue
        ),
        error = function(e) {
          warning(sprintf("pretrends() failed: %s", conditionMessage(e)),
                  call. = FALSE)
          NULL
        }
      )
      if (!is.null(pt)) {
        df_power <- if (!is.null(pt$df_power)) as.data.frame(pt$df_power) else data.frame()
        pretrends_result <- list(
          df_power  = df_power,
          deltatrue = as.list(as.numeric(deltatrue))
        )
      }
    }
  }

  list(
    detectable_slopes = slopes,
    pretrends         = pretrends_result,
    reference_period  = reference_period,
    alpha             = alpha,
    tVec              = as.integer(tVec)
  )
}
