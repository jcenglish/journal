require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "valid with email and password" do
    user = build_user(email: "new@example.com")

    assert user.valid?
  end

  test "invalid without email" do
    user = build_user(email: nil)

    assert_not user.valid?
  end

  test "invalid with a duplicate email" do
    user = build_user(email: users(:one).email)

    assert_not user.valid?
  end

  test "invalid with a duplicate email differing only by case" do
    user = build_user(email: users(:one).email.upcase)

    assert_not user.valid?
  end

  test "normalizes email to a stripped, downcased form" do
    user = build_user(email: "  New@Example.com  ")

    assert_equal "new@example.com", user.email
  end

  # The browser sends a 44-char base64 auth hash as the password. bcrypt rejects
  # anything over 72 bytes, so this documents the ceiling that hash sits under —
  # a future switch to, say, hex encoding would push past it.
  test "invalid with a password over bcrypt's 72-byte limit" do
    user = build_user(email: "long@example.com", password: "a" * 73)

    assert_not user.valid?
  end

  test "invalid without an encrypted data key" do
    user = build_user(email: "keyless@example.com", encrypted_data_key: nil)

    assert_not user.valid?
  end

  test "authenticates with the correct password" do
    user = build_user(email: "auth@example.com").tap(&:save!)

    assert user.authenticate("password123")
    assert_not user.authenticate("wrong")
  end

  private
    def build_user(email:, password: "password123", encrypted_data_key: "wrapped-key")
      User.new(email: email, password: password, encrypted_data_key: encrypted_data_key)
    end
end
