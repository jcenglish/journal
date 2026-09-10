require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Backend
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # api_only strips cookies and sessions out of the middleware stack. Add back
    # exactly those two (no flash, no CSP, no Rack::MethodOverride) so session-based
    # auth works. See design-decisions.md for the CSRF posture this implies:
    # SameSite=Lax + a same-origin deployment + a JSON-only body requirement,
    # rather than a synchronizer token (ActionController::API has no CSRF module).
    config.session_store :cookie_store,
      key: "_journal_session",
      same_site: :lax,
      httponly: true,
      secure: Rails.env.production?

    # Inserted at the same positions the non-api stack uses. `middleware.use` would
    # append them to the very bottom of the stack instead, after Rack::ETag.
    config.middleware.insert_after ActionDispatch::Callbacks, ActionDispatch::Cookies
    config.middleware.insert_after ActionDispatch::Cookies, config.session_store, config.session_options
  end
end
