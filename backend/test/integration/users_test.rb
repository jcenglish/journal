require "test_helper"

class UsersTest < ActionDispatch::IntegrationTest
  test "returns the signed-in user" do
    sign_in_as users(:one)

    get me_path

    assert_response :success
    assert_equal users(:one).id, response.parsed_body["id"]
    assert_equal users(:one).email, response.parsed_body["email"]
  end

  test "requires authentication" do
    get me_path

    assert_response :unauthorized
  end

  # The IDOR case for this slice: "me" is derived from the session alone, so no
  # amount of client-supplied id can steer it at another user's record.
  test "cannot be steered at another user with params" do
    sign_in_as users(:one)

    get me_path, params: { id: users(:two).id, user_id: users(:two).id }

    assert_response :success
    assert_equal users(:one).id, response.parsed_body["id"]
    assert_not_equal users(:two).id, response.parsed_body["id"]
  end

  test "a session for a deleted user is unauthorized rather than an error" do
    sign_in_as users(:one)
    users(:one).destroy!

    get me_path

    assert_response :unauthorized
  end
end
