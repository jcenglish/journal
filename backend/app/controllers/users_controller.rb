class UsersController < ApplicationController
  # Answers "who am I" from the session alone. Reads no params, so there is no
  # id for a caller to swap in for someone else's.
  def show
    render json: { id: current_user.id, email: current_user.email }
  end
end
