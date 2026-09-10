# Session handling for a zero-knowledge app: the session only ever identifies
# *who* the user is. It carries nothing that could decrypt their data — the
# encryption key is derived in the browser and never leaves it.
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private
    # Every query in this app reaches data through this, never through a bare
    # Model.find — see CLAUDE.md's "Security & encryption". Encryption is no
    # defense at all if authorization is broken.
    def current_user
      @current_user ||= User.find_by(id: session[:user_id])
    end

    def require_authentication
      current_user || render_unauthorized
    end

    def render_unauthorized
      render json: { error: "Unauthorized" }, status: :unauthorized
    end

    def start_new_session_for(user)
      reset_session # Issue a fresh session id whenever privilege changes (fixation).
      session[:user_id] = user.id
      @current_user = user
    end

    def terminate_session
      reset_session
      @current_user = nil
    end
end
