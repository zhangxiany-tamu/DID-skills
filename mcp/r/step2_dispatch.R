# ============================================================================
# did-mcp — Step 2 dispatch handler
# ============================================================================

dispatch_diagnose_twfe <- function(id, params) {
  run_with_capture(id, function() {
    panel_id  <- params$panel_id
    handle_id <- params$handle_id
    if (is.null(panel_id))  stop("diagnose_twfe: `panel_id` is required",  call. = FALSE)
    if (is.null(handle_id)) stop("diagnose_twfe: `handle_id` is required", call. = FALSE)

    schema <- list(
      id_var           = params$id_var,
      time_var         = params$time_var,
      treat_timing_var = params$treat_timing_var,
      treat_var        = params$treat_var,
      outcome_var      = params$outcome_var
    )
    if (is.null(schema$id_var) || is.null(schema$time_var) ||
        is.null(schema$treat_timing_var)) {
      stop("diagnose_twfe: id_var / time_var / treat_timing_var are required (read from panel handle schema).",
           call. = FALSE)
    }

    df <- get_object(panel_id)
    out <- run_diagnose_twfe(df, schema, params)

    # Serialize nested structures as plain lists so jsonlite emits stable JSON.
    bacon_payload <- NULL
    if (!is.null(out$bacon)) {
      bacon_payload <- list(
        forbidden_weight_pct = out$bacon$forbidden_weight_pct,
        severity             = out$bacon$severity,
        overall_estimate     = out$bacon$overall_estimate,
        n_pairs              = out$bacon$n_pairs,
        by_type              = out$bacon$by_type
      )
    }

    weights_payload <- NULL
    if (!is.null(out$weights)) {
      weights_payload <- list(
        negative_weight_pct = out$weights$negative_weight_pct,
        severity            = out$weights$severity,
        n_positive          = out$weights$n_positive,
        n_negative          = out$weights$n_negative,
        sum_positive        = out$weights$sum_positive,
        sum_negative        = out$weights$sum_negative,
        beta                = out$weights$beta,
        sensibility         = out$weights$sensibility,
        type                = out$weights$type
      )
    }

    result <- list(
      handle                      = handle_id,
      source_panel                = panel_id,
      bacon                       = bacon_payload,
      weights                     = weights_payload,
      overall_severity            = out$overall_severity,
      recommendation              = out$recommendation,
      treat_col_used              = out$treat_col_used,
      n_monotonicity_violations   = out$n_monotonicity_violations
    )

    stored <- out
    class(stored) <- c("twfe_diagnostic_result", "list")
    store_object(handle_id, stored)

    list(
      result = result,
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "twfe_diagnostic",
          rClass    = "twfe_diagnostic_result",
          summary   = sprintf("twfe_diagnostic on %s: overall=%s bacon=%s weights=%s",
                              panel_id, out$overall_severity,
                              out$bacon$severity %||% "skipped",
                              out$weights$severity %||% "skipped"),
          sizeBytes = object_size(stored)
        )
      )
    )
  })
}
