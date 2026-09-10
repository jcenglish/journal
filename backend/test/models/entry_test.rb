require "test_helper"

class EntryTest < ActiveSupport::TestCase
  test "valid with mood and health in range" do
    entry = Entry.new(
      content: "Today was fine.",
      mood: 3,
      health: 4,
      entry_date: Date.current,
      journal: journals(:one)
    )

    assert entry.valid?
  end

  test "invalid when mood is out of range" do
    entry = Entry.new(
      content: "Today was fine.",
      mood: 0,
      health: 4,
      entry_date: Date.current,
      journal: journals(:one)
    )

    assert_not entry.valid?
  end

  test "invalid when health is out of range" do
    entry = Entry.new(
      content: "Today was fine.",
      mood: 3,
      health: 6,
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

  test "mood/health CHECK is enforced at the DB level, not just app validation" do
    entry = entries(:one)

    assert_db_constraint_violation(
      "UPDATE entries SET mood = 9 WHERE id = #{entry.id}",
      matching: /mood_range_check/
    )
  end
end
