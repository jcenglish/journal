require "test_helper"

class TagEntryTest < ActiveSupport::TestCase
  test "valid with a unique tag/entry pair belonging to the same user" do
    other_entry = Entry.new(
      content: "ciphertext-content-other",
      mood: "ciphertext-mood-other",
      health: "ciphertext-health-other",
      entry_date: Date.current,
      journal: journals(:one) # same user as tags(:one)
    )
    tag_entry = TagEntry.new(tag: tags(:one), entry: other_entry)

    assert tag_entry.valid?
  end

  test "invalid when tag/entry pair is duplicated" do
    tag_entry = TagEntry.new(tag: tags(:one), entry: entries(:one))

    assert_not tag_entry.valid?
  end

  test "invalid when the tag and entry belong to different users" do
    tag_entry = TagEntry.new(tag: tags(:one), entry: entries(:two))

    assert_not tag_entry.valid?
    assert_includes tag_entry.errors[:tag], "must belong to the same user as the entry"
  end

  test "(tag_id, entry_id) uniqueness is enforced at the DB level, not just app validation" do
    existing = tag_entries(:one)

    assert_db_constraint_violation(
      "INSERT INTO tag_entries (tag_id, entry_id, created_at, updated_at) " \
      "VALUES (#{existing.tag_id}, #{existing.entry_id}, NOW(), NOW())",
      matching: /index_tag_entries_on_tag_id_and_entry_id/
    )
  end
end
