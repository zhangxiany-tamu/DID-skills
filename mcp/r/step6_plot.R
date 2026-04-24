# ============================================================================
# did-mcp — did_plot: event study + sensitivity plots
# ============================================================================
# Two plot kinds, auto-picked from the source handle's R class:
#   * event_study (list with betahat/sigma/tVec) → point + 95% CI event plot,
#     with a dashed horizontal line at y=0 and a vertical line at t=-0.5.
#   * honest_did_result → robust CIs vs M (relative_magnitudes or smoothness),
#     with the original (non-robust) CI overlaid as a reference band.
#
# Output is a PNG on disk under tempdir()/did-mcp-plots, handle-keyed. The
# `plot_file` metadata record is stored in the object store so the handle
# survives worker recycle (same pattern as step1_plots.R).
# ============================================================================

plot_event_study <- function(es, title, xlab, ylab, alpha) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("did_plot requires `ggplot2`. Run mcp/r/install_packages.R.", call. = FALSE)
  }
  tVec <- as.integer(es$tVec)
  betahat <- as.numeric(es$betahat)
  se <- sqrt(diag(as.matrix(es$sigma)))
  z <- stats::qnorm(1 - alpha / 2)

  df <- data.frame(
    event_time = tVec,
    estimate   = betahat,
    lower      = betahat - z * se,
    upper      = betahat + z * se
  )
  df <- df[order(df$event_time), ]

  ggplot2::ggplot(df, ggplot2::aes(x = event_time, y = estimate)) +
    ggplot2::geom_hline(yintercept = 0, linetype = "dashed", color = "grey40") +
    ggplot2::geom_vline(xintercept = -0.5, linetype = "dotted", color = "grey40") +
    ggplot2::geom_errorbar(ggplot2::aes(ymin = lower, ymax = upper),
                           width = 0.2, color = "steelblue") +
    ggplot2::geom_point(size = 2, color = "steelblue") +
    ggplot2::scale_x_continuous(breaks = tVec) +
    ggplot2::labs(title = title, x = xlab, y = ylab) +
    ggplot2::theme_minimal()
}

plot_honest_sensitivity <- function(hr, title, xlab, ylab) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("did_plot requires `ggplot2`. Run mcp/r/install_packages.R.", call. = FALSE)
  }

  robust <- as.data.frame(hr$robust)
  m_col <- hr$m_col %||% "Mbar"
  if (!m_col %in% names(robust)) {
    stop(sprintf("did_plot: expected '%s' column on robust results; have: %s",
                 m_col, paste(names(robust), collapse = ", ")), call. = FALSE)
  }

  robust$.m <- as.numeric(robust[[m_col]])

  original <- hr$original
  orig_lb <- as.numeric(original$lb %||% NA_real_)
  orig_ub <- as.numeric(original$ub %||% NA_real_)

  p <- ggplot2::ggplot(robust, ggplot2::aes(x = .m))
  if (is.finite(orig_lb) && is.finite(orig_ub)) {
    p <- p + ggplot2::geom_rect(
      xmin = -Inf, xmax = Inf,
      ymin = orig_lb, ymax = orig_ub,
      fill = "grey85", alpha = 0.4,
      inherit.aes = FALSE
    )
  }
  p +
    ggplot2::geom_hline(yintercept = 0, linetype = "dashed", color = "grey40") +
    ggplot2::geom_errorbar(ggplot2::aes(ymin = lb, ymax = ub),
                           width = 0.05, color = "firebrick") +
    ggplot2::geom_point(ggplot2::aes(y = (lb + ub) / 2), size = 2, color = "firebrick") +
    ggplot2::labs(title = title, x = xlab, y = ylab) +
    ggplot2::theme_minimal()
}

# ---- Dispatch handler -------------------------------------------------------

dispatch_plot <- function(id, params) {
  run_with_capture(id, function() {
    source_id <- params$source_id
    handle_id <- params$handle_id
    if (is.null(source_id)) stop("did_plot: `source_id` is required", call. = FALSE)
    if (is.null(handle_id)) stop("did_plot: `handle_id` is required", call. = FALSE)

    obj <- get_object(source_id)
    source_kind <- if (inherits(obj, "honest_did_result")) {
      "honest_sensitivity"
    } else if (is.list(obj) && !is.null(obj$betahat) && !is.null(obj$tVec)) {
      "event_study"
    } else {
      stop(sprintf("did_plot: source '%s' is neither an event_study nor an honest_did_result (class: %s)",
                   source_id, paste(class(obj), collapse = "/")), call. = FALSE)
    }

    width  <- as.numeric(params$width  %||% 8)
    height <- as.numeric(params$height %||% 5)
    alpha  <- as.numeric(params$alpha  %||% 0.05)
    title  <- params$title
    xlab   <- params$xlab
    ylab   <- params$ylab

    if (source_kind == "event_study") {
      if (is.null(title)) title <- sprintf("Event study (%s)", source_id)
      if (is.null(xlab))  xlab  <- "Event time"
      if (is.null(ylab))  ylab  <- "Estimate (95% CI)"
      p <- plot_event_study(obj, title, xlab, ylab, alpha)
    } else {
      if (is.null(title)) title <- sprintf("HonestDiD sensitivity (%s)", source_id)
      if (is.null(xlab))  xlab  <- (obj$m_col %||% "Mbar")
      if (is.null(ylab))  ylab  <- "Robust CI (shaded = original CI)"
      p <- plot_honest_sensitivity(obj, title, xlab, ylab)
    }

    plots_dir <- file.path(tempdir(), "did-mcp-plots")
    if (!dir.exists(plots_dir)) {
      dir.create(plots_dir, recursive = TRUE, showWarnings = FALSE)
    }
    path <- file.path(plots_dir, paste0(handle_id, ".png"))
    grDevices::png(filename = path, width = width, height = height,
                   units = "in", res = 150)
    print(p)
    grDevices::dev.off()

    sz <- if (file.exists(path)) as.numeric(file.info(path)$size) else 0
    plot_info <- list(
      path       = path,
      kind       = source_kind,
      source     = source_id,
      created_at = Sys.time()
    )
    class(plot_info) <- c("plot_file", "list")
    store_object(handle_id, plot_info)

    list(
      result = list(
        handle = handle_id,
        source = source_id,
        kind   = source_kind,
        path   = path
      ),
      objectsCreated = list(
        list(
          id        = handle_id,
          type      = "plot",
          rClass    = "plot_file",
          summary   = sprintf("plot (%s from %s): %s", source_kind, source_id, path),
          sizeBytes = sz,
          schema    = list(path = path, plot_kind = source_kind, source = source_id)
        )
      )
    )
  })
}
