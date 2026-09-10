require "test_helper"

class TagEntryTest < ActiveSupport::TestCase
  test "valid with a unique tag/entry pair" do
    tag_entry = TagEntry.new(tag: tags(:one), entry: entries(:two))

    assert tag_entry.valid?
  end

  test "invalid when tag/entry pair is duplicated" do
    tag_entry = TagEntry.new(tag: tags(:one), entry: entries(:one))

    assert_not tag_entry.valid?
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
