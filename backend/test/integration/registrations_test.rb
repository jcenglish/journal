require "test_helper"

class RegistrationsTest < ActionDispatch::IntegrationTest
  # A stand-in for the wrapped data key the browser produces. The server treats
  # it as an opaque string, so its contents don't matter here.
  WRAPPED_KEY = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA="

  test "signup creates an account and starts a session" do
    assert_difference "User.count", 1 do
      post signup_path, params: signup_params(email: "new@example.com"), as: :json
    end

    assert_response :created
    assert_equal User.last.id, session[:user_id]
  end

  test "signup response exposes no password digest" do
    post signup_path, params: signup_params(email: "new@example.com"), as: :json

    body = response.parsed_body

    assert_equal "new@example.com", body["email"]
    assert_equal WRAPPED_KEY, body["encrypted_data_key"]
    assert_not_includes body.keys, "password_digest"
  end

  test "signup normalizes the email before storing it" do
    post signup_path, params: signup_params(email: "  New@Example.COM  "), as: :json

    assert_response :created
    assert_equal "new@example.com", User.last.email
  end

  test "signup rejects a duplicate email without creating a user or a session" do
    assert_no_difference "User.count" do
      post signup_path, params: signup_params(email: users(:one).email), as: :json
    end

    assert_response :unprocessable_content
    assert_nil session[:user_id]
  end

  test "signup rejects a duplicate email differing only by case" do
    assert_no_difference "User.count" do
      post signup_path, params: signup_params(email: users(:one).email.upcase), as: :json
    end

    assert_response :unprocessable_content
  end

  test "signup requires a password" do
    assert_no_difference "User.count" do
      post signup_path, params: { user: { email: "new@example.com", encrypted_data_key: WRAPPED_KEY } }, as: :json
    end

    assert_response :unprocessable_content
  end

  test "signup requires an encrypted data key" do
    assert_no_difference "User.count" do
      post signup_path, params: { user: { email: "new@example.com", password: "derived-auth-hash" } }, as: :json
    end

    assert_response :unprocessable_content
  end

  # Part of the CSRF posture: a cross-site HTML form can't send JSON, so
  # requiring it keeps the only cookie-bearing cross-origin write out.
  test "signup rejects a non-JSON body" do
    assert_no_difference "User.count" do
      post signup_path, params: signup_params(email: "new@example.com")
    end

    assert_response :unsupported_media_type
  end

  private
    def signup_params(email:)
      { user: { email: email, password: "derived-auth-hash", encrypted_data_key: WRAPPED_KEY } }
    end
end
