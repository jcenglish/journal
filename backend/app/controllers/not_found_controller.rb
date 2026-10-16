class NotFoundController < ApplicationController
  allow_unauthenticated_access
  skip_before_action :require_json_body

  def show
    render json: { error: "Not Found" }, status: :not_found
  end
end
