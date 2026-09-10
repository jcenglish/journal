class SessionsController < ApplicationController
  allow_unauthenticated_access only: :create

  rate_limit to: 10, within: 3.minutes, only: :create

  def create
    # authenticate_by, not find_by(...)&.authenticate: it runs a dummy digest when
    # the email is unknown, so the response time doesn't reveal which addresses
    # have accounts. Matching bodies alone would still leak it via timing.
    user = User.authenticate_by(email: session_params[:email], password: session_params[:password])

    if user
      start_new_session_for(user)
      render json: user_json(user), status: :created
    else
      # Identical response for a wrong password and an unknown email, so login
      # can't be used to enumerate which addresses have accounts.
      render json: { error: "Invalid email or password" }, status: :unauthorized
    end
  end

  def destroy
    terminate_session
    head :no_content
  end

  private
    def session_params
      params.require(:session).permit(:email, :password)
    end

    # The client needs its wrapped data key back to unwrap in the browser; the
    # server can't do anything with it.
    def user_json(user)
      { id: user.id, email: user.email, encrypted_data_key: user.encrypted_data_key }
    end
end
