require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "valid with email and password" do
    user = User.new(email: "new@example.com", password: "password123")

    assert user.valid?
  end

  test "invalid without email" do
    user = User.new(password: "password123")

    assert_not user.valid?
  end

  test "invalid with a duplicate email" do
    user = User.new(email: users(:one).email, password: "password123")

    assert_not user.valid?
  end

  test "invalid with a duplicate email differing only by case" do
    user = User.new(email: users(:one).email.upcase, password: "password123")

    assert_not user.valid?
  end

  test "normalizes email to a stripped, downcased form" do
    user = User.new(email: "  New@Example.com  ", password: "password123")

    assert_equal "new@example.com", user.email
  end

  test "authenticates with the correct password" do
    user = User.create!(email: "auth@example.com", password: "password123")

    assert user.authenticate("password123")
    assert_not user.authenticate("wrong")
  end
end
