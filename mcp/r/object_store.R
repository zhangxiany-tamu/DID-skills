# ============================================================================
# did-mcp — In-Memory Object Store
# ============================================================================
# Handle-keyed registry of R objects created by did_* tools. TypeScript mints
# the handle id (e.g. "panel_1", "design_profile_1") via nextHandleId and passes
# it as params$handle_id; R stores the result under that key. persist/restore
# use saveRDS/readRDS into the session's /tmp dir to survive worker recycle.
# ============================================================================

.object_store <- new.env(parent = emptyenv())

store_object <- function(id, obj) {
  assign(id, obj, envir = .object_store)
  invisible(id)
}

get_object <- function(id) {
  if (!exists(id, envir = .object_store, inherits = FALSE)) {
    stop(sprintf("handle '%s' not found in this worker", id), call. = FALSE)
  }
  get(id, envir = .object_store, inherits = FALSE)
}

drop_object <- function(id) {
  if (exists(id, envir = .object_store, inherits = FALSE)) {
    rm(list = id, envir = .object_store)
    TRUE
  } else {
    FALSE
  }
}

list_object_ids <- function() {
  ls(envir = .object_store, sorted = FALSE)
}

has_object <- function(id) {
  exists(id, envir = .object_store, inherits = FALSE)
}

# object_size is used by dispatch handlers to populate RpcObjectCreated.sizeBytes
object_size <- function(obj) {
  as.numeric(object.size(obj))
}
