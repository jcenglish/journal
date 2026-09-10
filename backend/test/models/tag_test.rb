require "test_helper"

class TagTest < ActiveSupport::TestCase
  test "valid with content, color, and user" do
    tag = Tag.new(content: "Travel", color: "#2563eb", user: users(:one))

    assert tag.valid?
  end

  test "invalid without content" do
    tag = Tag.new(color: "#2563eb", user: users(:one))

    assert_not tag.valid?
  end

  test "invalid without a user" do
    tag = Tag.new(content: "Travel", color: "#2563eb")

    assert_not tag.valid?
  end
end
