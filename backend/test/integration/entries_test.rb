require "test_helper"

class EntriesTest < ActionDispatch::IntegrationTest
  def entry_body(**overrides)
    {
      entry: {
        title: "ciphertext-title",
        content: "ciphertext-content",
        mood: "ciphertext-mood",
        health: "ciphertext-health",
        entry_date: "2026-09-01"
      }.merge(overrides)
    }
  end

  test "lists a journal's entries newest entry_date first" do
    sign_in_as users(:one)
    older = journals(:one).entries.create!(entry_body(entry_date: "2026-01-01")[:entry])
    newer = journals(:one).entries.create!(entry_body(entry_date: "2026-12-31")[:entry])

    get journal_entries_path(journals(:one))

    assert_response :success
    ids = response.parsed_body["entries"].map { |entry| entry["id"] }
    assert_equal [ newer.id, entries(:one).id, older.id ], ids
    assert_nil response.parsed_body["next_page"]
  end

  test "list returns only what the list screen needs, not content" do
    sign_in_as users(:one)

    get journal_entries_path(journals(:one))

    entry = response.parsed_body["entries"].first
    assert_equal %w[entry_date id title], entry.keys.sort
  end

  test "paginates the list" do
    sign_in_as users(:one)
    EntriesController::PER_PAGE.times { journals(:one).entries.create!(entry_body[:entry]) }

    get journal_entries_path(journals(:one))

    assert_equal EntriesController::PER_PAGE, response.parsed_body["entries"].size
    assert_equal 2, response.parsed_body["next_page"]

    get journal_entries_path(journals(:one), page: 2)

    assert_equal 1, response.parsed_body["entries"].size
    assert_nil response.parsed_body["next_page"]
  end

  test "an absurd page number is an empty page, not a database error" do
    sign_in_as users(:one)

    get journal_entries_path(journals(:one), page: "99999999999999999999")

    assert_response :success
    assert_equal({ "entries" => [], "next_page" => nil }, response.parsed_body)
  end

  test "empty list for a journal with no entries" do
    sign_in_as users(:one)
    entries(:one).destroy!

    get journal_entries_path(journals(:one))

    assert_response :success
    assert_equal({ "entries" => [], "next_page" => nil }, response.parsed_body)
  end

  test "shows an entry with its ciphertext fields" do
    sign_in_as users(:one)

    get journal_entry_path(journals(:one), entries(:one))

    assert_response :success
    body = response.parsed_body
    assert_equal "ciphertext-content-one", body["content"]
    assert_equal "ciphertext-title-one", body["title"]
    assert_equal "ciphertext-mood-one", body["mood"]
    assert_equal "ciphertext-health-one", body["health"]
    assert_equal "2026-09-09", body["entry_date"]
  end

  test "creates an entry, storing the ciphertext exactly as sent" do
    sign_in_as users(:one)

    assert_difference -> { journals(:one).entries.count }, 1 do
      post journal_entries_path(journals(:one)), params: entry_body, as: :json
    end

    assert_response :created
    entry = Entry.find(response.parsed_body["id"])
    assert_equal "ciphertext-content", entry.content
    assert_equal "ciphertext-title", entry.title
    assert_equal "ciphertext-mood", entry.mood
    assert_equal "ciphertext-health", entry.health
    assert_equal Date.new(2026, 9, 1), entry.entry_date
  end

  test "rejects an entry missing a required field" do
    sign_in_as users(:one)

    %i[content mood health entry_date].each do |field|
      assert_no_difference -> { Entry.count } do
        post journal_entries_path(journals(:one)), params: entry_body(field => ""), as: :json
      end

      assert_response :unprocessable_content, "expected #{field} to be required"
    end
  end

  test "updates an entry" do
    sign_in_as users(:one)

    patch journal_entry_path(journals(:one), entries(:one)),
      params: entry_body(content: "new-ciphertext", entry_date: "2026-02-02"), as: :json

    assert_response :success
    entries(:one).reload
    assert_equal "new-ciphertext", entries(:one).content
    assert_equal Date.new(2026, 2, 2), entries(:one).entry_date
  end

  test "requires authentication" do
    get journal_entries_path(journals(:one))
    assert_response :unauthorized

    get journal_entry_path(journals(:one), entries(:one))
    assert_response :unauthorized

    post journal_entries_path(journals(:one)), params: entry_body, as: :json
    assert_response :unauthorized

    patch journal_entry_path(journals(:one), entries(:one)), params: entry_body, as: :json
    assert_response :unauthorized
  end

  # IDOR: every route is reached through current_user's journals, so another
  # user's entry is a 404 whether addressed through their journal or smuggled
  # under one of ours.
  test "cannot read another user's entry by ID" do
    sign_in_as users(:one)

    get journal_entry_path(journals(:two), entries(:two))
    assert_response :not_found

    get journal_entry_path(journals(:one), entries(:two))
    assert_response :not_found
  end

  test "cannot list another user's journal's entries" do
    sign_in_as users(:one)

    get journal_entries_path(journals(:two))

    assert_response :not_found
  end

  test "cannot create an entry in another user's journal" do
    sign_in_as users(:one)

    assert_no_difference -> { Entry.count } do
      post journal_entries_path(journals(:two)), params: entry_body, as: :json
    end

    assert_response :not_found
  end

  test "cannot update another user's entry" do
    sign_in_as users(:one)

    patch journal_entry_path(journals(:two), entries(:two)), params: entry_body(content: "hijacked"), as: :json
    assert_response :not_found

    patch journal_entry_path(journals(:one), entries(:two)), params: entry_body(content: "hijacked"), as: :json
    assert_response :not_found

    assert_equal "ciphertext-content-two", entries(:two).reload.content
  end

  test "cannot move an entry into another user's journal" do
    sign_in_as users(:one)

    patch journal_entry_path(journals(:one), entries(:one)),
      params: entry_body(journal_id: journals(:two).id), as: :json

    assert_equal journals(:one), entries(:one).reload.journal
  end
end
