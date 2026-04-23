# ============================================================================
# did-mcp — R Bridge
# ============================================================================
# Persistent R subprocess. Reads NDJSON from stdin, dispatches RPC calls,
# writes NDJSON to stdout. One JSON object per line.
#
# Phase 1: only `ping` is implemented. Subsequent phases add load_panel,
# check_panel, profile_design, plot_rollout, recode_never_treated, estimate,
# compare_estimators, extract_event_study.
# ============================================================================

suppressPackageStartupMessages({
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    cat('{"id":0,"error":{"code":99,"message":"jsonlite is not installed. Run mcp/r/install_packages.R first."}}', "\n", sep = "")
    flush(stdout())
    quit(status = 1)
  }
  library(jsonlite)
})

# NULL-coalesce helper
`%||%` <- function(a, b) if (is.null(a)) b else a

# ---- Response Helpers -------------------------------------------------------

send_response <- function(resp) {
  tryCatch({
    json <- toJSON(resp, auto_unbox = TRUE, null = "null", na = "string",
                   force = TRUE, pretty = FALSE)
    cat(json, "\n", sep = "")
    flush(stdout())
  }, error = function(e) {
    # Fallback: send minimal error envelope if toJSON fails
    safe_msg <- gsub('"', '\\\\"', conditionMessage(e))
    cat(paste0('{"id":', resp$id %||% -1,
               ',"error":{"code":98,"message":"toJSON failed: ', safe_msg, '"}}'),
        "\n", sep = "")
    flush(stdout())
  })
}

error_response <- function(id, code, message, suggestion = NULL, traceback = NULL) {
  resp <- list(id = id, error = list(code = code, message = message))
  if (!is.null(suggestion)) resp$error$suggestion <- suggestion
  if (!is.null(traceback)) resp$error$traceback <- traceback
  resp
}

limited_traceback <- function() {
  tb <- .traceback(max.lines = 1)
  if (is.null(tb) || length(tb) == 0) return(character())
  unlist(tb)
}

# ---- Dispatch ---------------------------------------------------------------

dispatch <- function(req) {
  id <- req$id %||% -1L
  method <- req$method %||% ""
  params <- req$params %||% list()

  tryCatch(
    switch(method,
      "ping"         = dispatch_ping(id, params),
      "persist"      = dispatch_persist(id, params),
      "restore"      = dispatch_restore(id, params),
      "list_objects" = dispatch_list_objects(id, params),
      # Placeholders — implemented in later phases
      "load_panel"        = error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 2: Step 1 tools)")),
      "check_panel"       = error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 2: Step 1 tools)")),
      "profile_design"    = error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 2: Step 1 tools)")),
      "plot_rollout"      = error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 2: Step 1 tools)")),
      "recode_never_treated" = error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 2: Step 1 tools)")),
      "estimate"          = error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 3: Step 3 tools)")),
      "compare_estimators"= error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 3: Step 3 tools)")),
      "extract_event_study"= error_response(id, -2L, paste0("Method '", method, "' not yet implemented (coming in Phase 3: Step 3 tools)")),
      error_response(id, -1L, paste0("Unknown method: ", method))
    ),
    error = function(e) {
      error_response(id, 1L, conditionMessage(e),
                     traceback = paste(limited_traceback(), collapse = "\n"))
    }
  )
}

# ---- Method: ping -----------------------------------------------------------

dispatch_ping <- function(id, params) {
  echo <- params$echo %||% ""
  list(
    id = id,
    result = list(
      pong = TRUE,
      r_version = paste(R.version$major, R.version$minor, sep = "."),
      r_platform = R.version$platform,
      jsonlite_version = as.character(packageVersion("jsonlite")),
      echo = echo,
      bridge_pid = Sys.getpid()
    )
  )
}

# ---- Method: persist / restore (stubs for Phase 1) -------------------------
# These are called by the TypeScript worker pool during recycle. Phase 1 has
# no persistable objects yet (no tools create handles), so these are no-ops
# that return success. Full implementation lands with Step 1 tools in Phase 2.

dispatch_persist <- function(id, params) {
  list(
    id = id,
    result = list(persisted = list(), count = 0L),
    persistFailed = list()
  )
}

dispatch_restore <- function(id, params) {
  list(
    id = id,
    result = list(restored = list(), count = 0L)
  )
}

dispatch_list_objects <- function(id, params) {
  list(
    id = id,
    result = list(objects = list())
  )
}

# ---- Main Loop --------------------------------------------------------------

repeat {
  line <- tryCatch(readLines(con = "stdin", n = 1, warn = FALSE),
                   error = function(e) character(0))
  if (length(line) == 0) break  # stdin closed → exit cleanly
  if (nchar(line) == 0) next

  req <- tryCatch(
    fromJSON(line, simplifyVector = FALSE),
    error = function(e) NULL
  )

  if (is.null(req)) {
    send_response(error_response(-1L, 97L,
      paste0("Invalid JSON on stdin: ", substr(line, 1, 200))))
    next
  }

  resp <- dispatch(req)
  send_response(resp)
}
