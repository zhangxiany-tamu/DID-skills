# ============================================================================
# did-mcp — Step 4 + Step 5 dispatch handlers
# ============================================================================
# Both tools consume an `event_study` handle produced by Phase 3's
# did_extract_event_study. That handle is stored as
# list(betahat, sigma, tVec, sigma_is_diagonal_fallback, fallback_reason).
# ============================================================================

dispatch_honest_sensitivity <- function(id, params) {
  run_with_capture(id, function() {
    event_study_id <- params$event_study_id
    handle_id      <- params$handle_id
    if (is.null(event_study_id)) {
      stop("honest_sensitivity: `event_study_id` is required", call. = FALSE)
    }
    if (is.null(handle_id)) {
      stop("honest_sensitivity: `handle_id` is required", call. = FALSE)
    }

    es <- get_object(event_study_id)
    if (!is.list(es) || is.null(es$betahat) || is.null(es$sigma) || is.null(es$tVec)) {
      stop(sprintf("honest_sensitivity: handle '%s' is not an event_study (missing betahat/sigma/tVec).",
                   event_study_id), call. = FALSE)
    }

    out <- run_honest_sensitivity(es, params)

    # Serialize the robust data.frame as a list of rows so jsonlite emits a
    # stable JSON array of objects rather than column-major vectors.
    robust_rows <- lapply(seq_len(nrow(out$robust)), function(i) as.list(out$robust[i, ]))

    result <- list(
      handle             = handle_id,
      source_event_study = event_study_id,
      method             = out$method,
      m_column           = out$m_col,
      n_pre              = out$ps$n_pre,
      n_post             = out$ps$n_post,
      robust             = robust_rows,
      original           = out$original,
      breakdown_M        = as.numeric(out$breakdown_M)
    )

    stored <- list(
      robust        = out$robust,
      original      = out$original,
      breakdown_M   = out$breakdown_M,
      method        = out$method,
      m_col         = out$m_col,
      n_pre         = out$ps$n_pre,
      n_post        = out$ps$n_post
    )
    class(stored) <- c("honest_did_result", "list")
    store_object(handle_id, stored)

    list(
      result = result,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "honest_result",
          rClass    = "honest_did_result",
          summary   = sprintf("honest_sensitivity (%s) from %s: n_pre=%d n_post=%d breakdown=%s",
                              out$method, event_study_id,
                              out$ps$n_pre, out$ps$n_post,
                              if (is.na(out$breakdown_M)) "robust" else sprintf("%.3f", out$breakdown_M)),
          sizeBytes = object_size(stored)
        )
      )
    )
  })
}

dispatch_power_analysis <- function(id, params) {
  run_with_capture(id, function() {
    event_study_id <- params$event_study_id
    handle_id      <- params$handle_id
    if (is.null(event_study_id)) {
      stop("power_analysis: `event_study_id` is required", call. = FALSE)
    }
    if (is.null(handle_id)) {
      stop("power_analysis: `handle_id` is required", call. = FALSE)
    }

    es <- get_object(event_study_id)
    if (!is.list(es) || is.null(es$betahat) || is.null(es$sigma) || is.null(es$tVec)) {
      stop(sprintf("power_analysis: handle '%s' is not an event_study.",
                   event_study_id), call. = FALSE)
    }

    out <- run_power_analysis(es, params)

    pretrends_payload <- NULL
    if (!is.null(out$pretrends) && !is.null(out$pretrends$df_power)) {
      df <- out$pretrends$df_power
      pretrends_payload <- list(
        df_power  = lapply(seq_len(nrow(df)), function(i) as.list(df[i, ])),
        deltatrue = out$pretrends$deltatrue
      )
    }

    result <- list(
      handle              = handle_id,
      source_event_study  = event_study_id,
      reference_period    = out$reference_period,
      alpha               = out$alpha,
      tVec                = as.list(as.integer(out$tVec)),
      detectable_slopes   = out$detectable_slopes,
      pretrends           = pretrends_payload
    )

    stored <- list(
      detectable_slopes = out$detectable_slopes,
      pretrends         = out$pretrends,
      reference_period  = out$reference_period,
      alpha             = out$alpha,
      tVec              = out$tVec
    )
    class(stored) <- c("power_result", "list")
    store_object(handle_id, stored)

    n_slopes <- length(out$detectable_slopes)

    list(
      result = result,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "power_result",
          rClass    = "power_result",
          summary   = sprintf("power_analysis from %s: %d target power level(s) computed",
                              event_study_id, n_slopes),
          sizeBytes = object_size(stored)
        )
      )
    )
  })
}
