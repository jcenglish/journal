require "test_helper"

class SessionsTest < ActionDispatch::IntegrationTest
  test "login with correct credentials starts a session" do
    sign_in_as users(:one)

    assert_response :created
    assert_equal users(:one).id, session[:user_id]
    assert_equal users(:one).encrypted_data_key, response.parsed_body["encrypted_data_key"]
  end

  test "login with the wrong password is rejected and starts no session" do
    sign_in_as users(:one), password: "wrong"

    assert_response :unauthorized
    assert_nil session[:user_id]

    get me_path

    assert_response :unauthorized
  end

  # Identical responses keep login from revealing which emails have accounts.
  test "an unknown email is indistinguishable from a wrong password" do
    sign_in_as users(:one), password: "wrong"
    wrong_password = [ response.status, response.body ]

    post session_path, params: { session: { email: "nobody@example.com", password: "wrong" } }, as: :json
    unknown_email = [ response.status, response.body ]

    assert_equal wrong_password, unknown_email
  end

  test "logout ends the session" do
    sign_in_as users(:one)

    delete session_path

    assert_response :no_content
    assert_nil session[:user_id]

    get me_path

    assert_response :unauthorized
  end

  # The only regression test that catches someone dropping the session_store
  # options in config/application.rb.
  test "the session cookie is HttpOnly and SameSite=Lax" do
    sign_in_as users(:one)

    set_cookie = response.headers["Set-Cookie"]

    assert_match(/_journal_session/, set_cookie)
    assert_match(/HttpOnly/i, set_cookie)
    assert_match(/SameSite=Lax/i, set_cookie)
  end

  test "logging in issues a new session id" do
    get me_path # establishes a session cookie while unauthenticated
    before = cookies["_journal_session"]

    sign_in_as users(:one)

    assert_not_equal before, cookies["_journal_session"]
  end

  test "login rejects a non-JSON body" do
    post session_path, params: { session: { email: users(:one).email, password: FIXTURE_PASSWORD } }

    assert_response :unsupported_media_type
    assert_nil session[:user_id]
  end
end
