Rails.application.routes.draw do
  # Rails owns the /api prefix rather than a proxy rewriting it away, so the Vite
  # dev proxy and any production edge proxy stay the same trivial rule and can't
  # drift apart. See design-decisions.md.
  scope "/api", defaults: { format: :json } do
    post "signup", to: "registrations#create"
    resource :session, only: %i[create destroy]
    get "me", to: "users#show"
  end

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  # Deliberately left outside /api — Kamal's healthcheck expects it at the root.
  get "up" => "rails/health#show", as: :rails_health_check
end
