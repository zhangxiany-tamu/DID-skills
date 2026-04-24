# ============================================================================
# did-mcp — Step 1: did_recode_never_treated
# ============================================================================
# Unifies never-treated coding (0 / NA / Inf / max_plus_10) so a panel can be
# passed to the estimator that expects that convention. The recode function
# body is a byte-aligned copy of skill/references/did-step-1-treatment-
# structure.md:446-460. Do not edit semantically; re-sync on skill change.
# ============================================================================

recode_never_treated <- function(data, gname_var, target = c("zero", "na", "inf", "max_plus_10")) {
  target <- match.arg(target)
  g <- data[[gname_var]]

  # Identify never-treated (could be 0, NA, or Inf in source data)
  is_never <- is.na(g) | g == 0 | is.infinite(g)

  data[[gname_var]] <- switch(target,
    "zero"        = { g[is_never] <- 0;                        g },
    "na"          = { g[is_never] <- NA_real_;                  g },
    "inf"         = { g[is_never] <- Inf;                       g },
    "max_plus_10" = { g[is_never] <- max(g[!is_never], na.rm = TRUE) + 10; g }
  )
  data
}

# ---- Dispatch handler -------------------------------------------------------

dispatch_recode_never_treated <- function(id, params) {
  run_with_capture(id, function() {
    panel_id  <- params$panel_id
    handle_id <- params$handle_id
    target    <- params$target %||% "zero"

    if (is.null(panel_id))  stop("recode_never_treated: `panel_id` is required",  call. = FALSE)
    if (is.null(handle_id)) stop("recode_never_treated: `handle_id` is required", call. = FALSE)
    if (!target %in% c("zero", "na", "inf", "max_plus_10")) {
      stop(sprintf("recode_never_treated: target must be one of zero/na/inf/max_plus_10 (got '%s')", target),
           call. = FALSE)
    }

    treat_timing_var <- params$treat_timing_var
    if (is.null(treat_timing_var)) {
      stop("recode_never_treated: treat_timing_var is required (read from panel handle's schema).",
           call. = FALSE)
    }

    df <- get_object(panel_id)
    if (!treat_timing_var %in% names(df)) {
      stop(sprintf("recode_never_treated: column '%s' not found in panel %s", treat_timing_var, panel_id),
           call. = FALSE)
    }

    df_new <- recode_never_treated(df, treat_timing_var, target = target)
    store_object(handle_id, df_new)

    # Count how many rows were recoded (for the result summary)
    g_old <- df[[treat_timing_var]]
    g_new <- df_new[[treat_timing_var]]
    n_never_source <- sum(is.na(g_old) | g_old == 0 | is.infinite(g_old))

    # Build schema — inherit columns from source panel's RPC call params
    schema <- list(
      id_var           = params$id_var,
      time_var         = params$time_var,
      treat_timing_var = treat_timing_var
    )
    if (!is.null(params$treat_var)   && nzchar(params$treat_var))   schema$treat_var   <- params$treat_var
    if (!is.null(params$outcome_var) && nzchar(params$outcome_var)) schema$outcome_var <- params$outcome_var

    list(
      result = list(
        handle         = handle_id,
        source_handle  = panel_id,
        target         = target,
        gname_col      = treat_timing_var,
        n_never_source = n_never_source,
        n_obs          = nrow(df_new)
      ),
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "panel",
          rClass    = "data.frame",
          summary   = sprintf("panel (recoded never-treated in '%s' -> %s): %d obs",
                              treat_timing_var, target, nrow(df_new)),
          sizeBytes = object_size(df_new),
          schema    = schema
        )
      )
    )
  })
}
