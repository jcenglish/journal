require "test_helper"

class JournalsTest < ActionDispatch::IntegrationTest
  test "lists only the current user's journals" do
    sign_in_as users(:one)

    get journals_path

    assert_response :success
    ids = response.parsed_body.map { |journal| journal["id"] }
    assert_includes ids, journals(:one).id
    assert_not_includes ids, journals(:two).id
  end

  test "empty list for a user with no journals" do
    sign_in_as users(:two)
    journals(:two).destroy!

    get journals_path

    assert_response :success
    assert_equal [], response.parsed_body
  end

  test "requires authentication to list" do
    get journals_path

    assert_response :unauthorized
  end

  test "creates a journal for the current user" do
    sign_in_as users(:one)

    assert_difference -> { users(:one).journals.count }, 1 do
      post journals_path, params: { journal: { title: "ciphertext-title" } }, as: :json
    end

    assert_response :created
    assert_equal "ciphertext-title", response.parsed_body["title"]
  end

  test "rejects a journal with no title" do
    sign_in_as users(:one)

    post journals_path, params: { journal: { title: "" } }, as: :json

    assert_response :unprocessable_content
  end

  test "requires authentication to create" do
    post journals_path, params: { journal: { title: "ciphertext-title" } }, as: :json

    assert_response :unauthorized
  end

  # The IDOR case for this slice: listing never returns another user's journal,
  # no matter what a caller sends.
  test "cannot list another user's journals by any request shape" do
    sign_in_as users(:one)

    get journals_path, params: { user_id: users(:two).id }

    assert_response :success
    ids = response.parsed_body.map { |journal| journal["id"] }
    assert_not_includes ids, journals(:two).id
  end

  test "deleting a journal removes its entries and their tag associations" do
    sign_in_as users(:one)
    assert_equal [ entries(:one).id ], journals(:one).entries.ids
    assert_equal 1, TagEntry.where(entry: entries(:one)).count

    assert_difference -> { Journal.count } => -1, -> { Entry.count } => -1, -> { TagEntry.count } => -1 do
      delete journal_path(journals(:one))
    end

    assert_response :no_content
    assert Tag.exists?(tags(:one).id)
    assert Journal.exists?(journals(:two).id)
  end

  test "requires authentication to delete a journal" do
    assert_no_difference -> { Journal.count } do
      delete journal_path(journals(:one))
    end

    assert_response :unauthorized
  end

  test "cannot delete another user's journal" do
    sign_in_as users(:one)

    assert_no_difference [ -> { Journal.count }, -> { Entry.count }, -> { TagEntry.count } ] do
      delete journal_path(journals(:two))
    end

    assert_response :not_found
  end
end
