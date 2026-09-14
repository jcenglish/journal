class ApplicationController < ActionController::API
  include Authentication

  # Request bodies are always explicitly nested under a resource key
  # ({"user": {...}}, {"session": {...}}), never implicitly wrapped by
  # ParamsWrapper. That keeps the logged param shape unambiguous, which is the
  # precondition for tightening filter_parameter_logging to dotted, model-scoped
  # keys ("entry.title") in slice 4 — see CLAUDE.md's Guardrails.
  wrap_parameters format: []

  before_action :require_json_body, if: :write_request?

  private
    def write_request?
      request.post? || request.patch? || request.put?
    end

    # Part of the CSRF posture (see design-decisions.md). A cross-site HTML form
    # — the only way to make a cross-origin write without CORS — can only send
    # urlencoded, multipart, or text/plain. Requiring JSON closes that door.
    def require_json_body
      return if request.media_type == "application/json"

      render json: { error: "Unsupported Media Type" }, status: :unsupported_media_type
    end
end
