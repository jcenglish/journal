class RegistrationsController < ApplicationController
  allow_unauthenticated_access only: :create

  # Signup discloses account existence: a duplicate email returns 422 with
  # "Email has already been taken", which is the same fact SessionsController
  # goes out of its way to hide. Genuinely closing it needs email verification
  # (accept every signup, disclose nothing, confirm out of band), which needs a
  # mailer and is out of MVP scope. Rate limiting bounds how fast the oracle can
  # be walked rather than removing it — see design-decisions.md.
  rate_limit to: 10, within: 3.minutes, only: :create

  def create
    user = User.new(user_params)

    if user.save
      start_new_session_for(user)
      render json: user_json(user), status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_content
    end
  end

  private
    # `password` here is not the user's password — it's the base64 auth hash the
    # browser derived from it. The server is deliberately agnostic about that;
    # has_secure_password just bcrypts whatever arrives.
    def user_params
      params.require(:user).permit(:email, :password, :encrypted_data_key)
    end

    # Never `render json: user` — that would serialize password_digest.
    def user_json(user)
      { id: user.id, email: user.email, encrypted_data_key: user.encrypted_data_key }
    end
end
