require "test_helper"

class EntryTest < ActiveSupport::TestCase
  test "valid with mood and health present" do
    # mood/health hold client-side encrypted ciphertext, not a plain 1-5 integer —
    # the model can't and shouldn't validate the underlying rating's range. See
    # CLAUDE.md's Security & encryption section.
    entry = Entry.new(
      content: "Today was fine.",
      mood: "ciphertext-mood",
      health: "ciphertext-health",
      entry_date: Date.current,
      journal: journals(:one)
    )

    assert entry.valid?
  end

  test "invalid when mood or health is blank" do
    entry = Entry.new(
      content: "Today was fine.",
      mood: "",
      health: "ciphertext-health",
      entry_date: Date.current,
      journal: journals(:one)
    )

    assert_not entry.valid?
  end

  test "derives user from journal, has no fk:user" do
    entry = entries(:one)

    assert_not_respond_to entry, :user_id
    assert_equal entry.journal.user, entry.user
  end
end
