require "test_helper"

class JournalTest < ActiveSupport::TestCase
  test "valid with a title and user" do
    journal = Journal.new(title: "My Journal", user: users(:one))

    assert journal.valid?
  end

  test "invalid without a title" do
    journal = Journal.new(user: users(:one))

    assert_not journal.valid?
  end

  test "invalid without a user" do
    journal = Journal.new(title: "My Journal")

    assert_not journal.valid?
  end
end
