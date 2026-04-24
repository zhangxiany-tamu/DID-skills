# ============================================================================
# did-mcp — Step 1: did_load_panel
# ============================================================================
# Reads a CSV or Parquet file into a panel data.frame and registers it as a
# `panel` handle. Validates required column names. No byte-aligned skill function
# exists for loading (skill assumes in-memory data via `data(mpdta)`); this
# module is new code on the MCP side only.
# ============================================================================

dispatch_load_panel <- function(id, params) {
  run_with_capture(id, function() {
    path             <- params$path
    id_var           <- params$id_var
    time_var         <- params$time_var
    treat_timing_var <- params$treat_timing_var
    treat_var        <- params$treat_var        # optional
    outcome_var      <- params$outcome_var      # optional
    handle_id        <- params$handle_id

    if (is.null(path) || !nzchar(path)) stop("load_panel: `path` is required", call. = FALSE)
    if (is.null(id_var)) stop("load_panel: `id_var` is required", call. = FALSE)
    if (is.null(time_var)) stop("load_panel: `time_var` is required", call. = FALSE)
    if (is.null(treat_timing_var)) stop("load_panel: `treat_timing_var` is required", call. = FALSE)
    if (is.null(handle_id)) stop("load_panel: `handle_id` is required", call. = FALSE)

    if (!file.exists(path)) {
      stop(sprintf("load_panel: file not found: %s", path), call. = FALSE)
    }

    is_parquet <- grepl("\\.parquet$", path, ignore.case = TRUE)
    df <- if (is_parquet) {
      if (!requireNamespace("arrow", quietly = TRUE)) {
        stop("load_panel: .parquet requires the `arrow` package. Install with install.packages('arrow') or pass a CSV.",
             call. = FALSE)
      }
      tryCatch(
        as.data.frame(arrow::read_parquet(path)),
        error = function(e) stop(sprintf("load_panel: failed to read parquet: %s",
                                         conditionMessage(e)), call. = FALSE)
      )
    } else {
      tryCatch(
        utils::read.csv(path, stringsAsFactors = FALSE),
        error = function(e) stop(sprintf("load_panel: failed to read CSV: %s",
                                         conditionMessage(e)), call. = FALSE)
      )
    }

    required <- list(id_var = id_var, time_var = time_var, treat_timing_var = treat_timing_var)
    for (nm in names(required)) {
      col <- required[[nm]]
      if (!col %in% names(df)) {
        stop(sprintf("load_panel: column '%s' (%s) not found in file. Available: %s",
                     col, nm, paste(names(df), collapse = ", ")), call. = FALSE)
      }
    }
    for (nm in c("treat_var", "outcome_var")) {
      col <- params[[nm]]
      if (!is.null(col) && nzchar(col) && !col %in% names(df)) {
        stop(sprintf("load_panel: column '%s' (%s) not found in file. Available: %s",
                     col, nm, paste(names(df), collapse = ", ")), call. = FALSE)
      }
    }

    store_object(handle_id, df)

    n_obs     <- nrow(df)
    n_units   <- length(unique(df[[id_var]]))
    n_periods <- length(unique(df[[time_var]]))

    schema <- list(
      id_var           = id_var,
      time_var         = time_var,
      treat_timing_var = treat_timing_var
    )
    if (!is.null(treat_var)   && nzchar(treat_var))   schema$treat_var   <- treat_var
    if (!is.null(outcome_var) && nzchar(outcome_var)) schema$outcome_var <- outcome_var

    list(
      result = list(
        handle      = handle_id,
        file_path   = path,
        n_obs       = n_obs,
        n_units     = n_units,
        n_periods   = n_periods,
        columns     = as.list(names(df)),
        schema      = schema
      ),
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "panel",
          rClass    = "data.frame",
          summary   = sprintf("panel: %d obs, %d units x %d periods from %s",
                              n_obs, n_units, n_periods, basename(path)),
          sizeBytes = object_size(df),
          schema    = schema
        )
      )
    )
  })
}
