# ============================================================================
# did-mcp — Step 3 dispatch handlers
# ============================================================================
# bridge.R routes these three methods into run_with_capture(), which captures
# warnings + stdout into the RpcResponse envelope. Each handler validates
# inputs, runs the estimator wrapper, stores the raw R object, and returns
# both the standardized envelope and an RpcObjectCreated for the handle.
# ============================================================================

dispatch_estimate <- function(id, params) {
  run_with_capture(id, function() {
    panel_id  <- params$panel_id
    handle_id <- params$handle_id
    estimator <- params$estimator

    if (is.null(panel_id))  stop("estimate: `panel_id` is required",  call. = FALSE)
    if (is.null(handle_id)) stop("estimate: `handle_id` is required", call. = FALSE)
    if (is.null(estimator)) stop("estimate: `estimator` is required", call. = FALSE)

    schema <- list(
      id_var           = params$id_var,
      time_var         = params$time_var,
      treat_timing_var = params$treat_timing_var,
      treat_var        = params$treat_var,
      outcome_var      = params$outcome_var
    )
    if (is.null(schema$id_var) || is.null(schema$time_var) || is.null(schema$treat_timing_var)) {
      stop("estimate: id_var / time_var / treat_timing_var are required (read from panel handle schema).",
           call. = FALSE)
    }
    if (is.null(params$outcome_var) || !nzchar(params$outcome_var)) {
      stop("estimate: outcome_var is required.", call. = FALSE)
    }

    df <- get_object(panel_id)

    result <- run_estimator(estimator, df, schema, params, handle_id)

    list(
      result = result$std,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "estimate",
          rClass    = result$rClass,
          summary   = sprintf("estimate (%s) on panel=%s: ATT=%.4f",
                              estimator, panel_id,
                              result$std$overall$att %||% NA_real_),
          sizeBytes = object_size(result$r_object)
        )
      )
    )
  })
}

dispatch_compare_estimators <- function(id, params) {
  run_with_capture(id, function() {
    panel_id   <- params$panel_id
    estimators <- unlist(params$estimators %||% list())
    handle_ids <- unlist(params$handle_ids %||% list())

    if (is.null(panel_id)) stop("compare_estimators: `panel_id` is required", call. = FALSE)
    if (length(estimators) == 0) stop("compare_estimators: `estimators` must be non-empty", call. = FALSE)
    if (length(handle_ids) != length(estimators)) {
      stop("compare_estimators: one handle id per estimator is required.", call. = FALSE)
    }
    if (is.null(params$outcome_var) || !nzchar(params$outcome_var)) {
      stop("compare_estimators: `outcome_var` is required.", call. = FALSE)
    }

    schema <- list(
      id_var           = params$id_var,
      time_var         = params$time_var,
      treat_timing_var = params$treat_timing_var,
      treat_var        = params$treat_var,
      outcome_var      = params$outcome_var
    )
    if (is.null(schema$id_var) || is.null(schema$time_var) || is.null(schema$treat_timing_var)) {
      stop("compare_estimators: id_var / time_var / treat_timing_var are required.", call. = FALSE)
    }

    df <- get_object(panel_id)
    stop_on_error <- isTRUE(params$stop_on_error)

    envelopes <- list()
    created   <- list()
    errors    <- list()

    for (i in seq_along(estimators)) {
      est <- estimators[i]
      hid <- handle_ids[i]
      res <- tryCatch(
        run_estimator(est, df, schema, params, hid),
        error = function(e) list(error = conditionMessage(e))
      )
      if (!is.null(res$error)) {
        errors[[est]] <- res$error
        if (stop_on_error) {
          stop(sprintf("compare_estimators: %s failed: %s", est, res$error), call. = FALSE)
        }
        next
      }
      envelopes[[est]] <- res$std
      created[[length(created) + 1]] <- list(
        id        = hid,
        type      = "estimate",
        rClass    = res$rClass,
        summary   = sprintf("estimate (%s) on panel=%s: ATT=%.4f",
                            est, panel_id, res$std$overall$att %||% NA_real_),
        sizeBytes = object_size(res$r_object)
      )
    }

    # Build wide comparison table on event_time
    all_events <- integer()
    for (env in envelopes) {
      for (row in env$event_study) {
        all_events <- c(all_events, row$event_time)
      }
    }
    all_events <- sort(unique(all_events))
    table_rows <- vector("list", length(all_events))
    for (k in seq_along(all_events)) {
      e <- all_events[k]
      row <- list(event_time = as.integer(e))
      for (est in names(envelopes)) {
        match_row <- NULL
        for (r in envelopes[[est]]$event_study) {
          if (r$event_time == e) { match_row <- r; break }
        }
        row[[paste0(est, "_est")]] <- if (!is.null(match_row)) match_row$estimate else NA_real_
        row[[paste0(est, "_se")]]  <- if (!is.null(match_row)) match_row$se       else NA_real_
      }
      table_rows[[k]] <- row
    }

    result <- list(
      panel      = panel_id,
      estimators = as.list(estimators),
      envelopes  = envelopes,
      table      = table_rows,
      errors     = errors
    )

    list(
      result         = result,
      objectsCreated = created
    )
  })
}

dispatch_extract_event_study <- function(id, params) {
  run_with_capture(id, function() {
    estimate_id <- params$estimate_id
    handle_id   <- params$handle_id
    if (is.null(estimate_id)) stop("extract_event_study: `estimate_id` is required", call. = FALSE)
    if (is.null(handle_id))   stop("extract_event_study: `handle_id` is required",   call. = FALSE)

    obj <- get_object(estimate_id)
    es  <- extract_event_study(obj)

    min_e <- params$min_e
    max_e <- params$max_e
    if (!is.null(min_e) || !is.null(max_e)) {
      keep <- rep(TRUE, length(es$tVec))
      if (!is.null(min_e)) keep <- keep & es$tVec >= as.numeric(min_e)
      if (!is.null(max_e)) keep <- keep & es$tVec <= as.numeric(max_e)
      if (!any(keep)) {
        stop(sprintf(
          "extract_event_study: event window [%s, %s] keeps no event times",
          ifelse(is.null(min_e), "-Inf", as.character(min_e)),
          ifelse(is.null(max_e), "Inf", as.character(max_e))
        ), call. = FALSE)
      }
      es$betahat <- es$betahat[keep]
      es$tVec    <- es$tVec[keep]
      es$sigma   <- es$sigma[keep, keep, drop = FALSE]
    }

    if (length(es$betahat) != length(es$tVec)) {
      stop(sprintf("extract_event_study: betahat length (%d) != tVec length (%d)",
                   length(es$betahat), length(es$tVec)), call. = FALSE)
    }

    store_object(handle_id, es)

    # Surface the canonical form for downstream tools. sigma_is_diagonal_fallback
    # and fallback_reason let HonestDiD/pretrends consumers detect a degraded
    # VCOV without re-inspecting the matrix.
    result <- list(
      handle   = handle_id,
      source   = estimate_id,
      n        = length(es$tVec),
      tVec     = as.list(as.integer(es$tVec)),
      betahat  = as.list(as.numeric(es$betahat)),
      sigma    = lapply(seq_len(nrow(es$sigma)),
                        function(i) as.list(as.numeric(es$sigma[i, ]))),
      sigma_is_diagonal_fallback = isTRUE(es$sigma_is_diagonal_fallback),
      fallback_reason            = es$fallback_reason %||% NA_character_
    )

    list(
      result = result,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "event_study",
          rClass    = "list",
          summary   = sprintf("event_study (from %s): n=%d event times",
                              estimate_id, length(es$tVec)),
          sizeBytes = object_size(es)
        )
      )
    )
  })
}
