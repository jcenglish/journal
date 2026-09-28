require "test_helper"

class TagsTest < ActionDispatch::IntegrationTest
  test "lists only the current user's tags" do
    sign_in_as users(:one)

    get tags_path

    assert_response :success
    ids = response.parsed_body.map { |tag| tag["id"] }
    assert_includes ids, tags(:one).id
    assert_not_includes ids, tags(:two).id
  end

  test "empty list for a user with no tags" do
    sign_in_as users(:two)
    tags(:two).destroy!

    get tags_path

    assert_response :success
    assert_equal [], response.parsed_body
  end

  test "requires authentication to list" do
    get tags_path

    assert_response :unauthorized
  end

  test "creates a tag for the current user, storing the ciphertext exactly as sent" do
    sign_in_as users(:one)

    assert_difference -> { users(:one).tags.count }, 1 do
      post tags_path, params: { tag: { content: "ciphertext-content", color: "#2563eb" } }, as: :json
    end

    assert_response :created
    assert_equal "ciphertext-content", response.parsed_body["content"]
    assert_equal "#2563eb", response.parsed_body["color"]
  end

  test "rejects a tag with no content" do
    sign_in_as users(:one)

    post tags_path, params: { tag: { content: "", color: "#2563eb" } }, as: :json

    assert_response :unprocessable_content
  end

  test "requires authentication to create" do
    post tags_path, params: { tag: { content: "ciphertext-content", color: "#2563eb" } }, as: :json

    assert_response :unauthorized
  end

  # IDOR: listing never returns another user's tag, no matter what a caller sends.
  test "cannot list another user's tags by any request shape" do
    sign_in_as users(:one)

    get tags_path, params: { user_id: users(:two).id }

    assert_response :success
    ids = response.parsed_body.map { |tag| tag["id"] }
    assert_not_includes ids, tags(:two).id
  end
end
