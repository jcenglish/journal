class User < ApplicationRecord
  has_secure_password

  has_many :journals, dependent: :destroy
  has_many :tags, dependent: :destroy

  # Normalize so "Foo@example.com" and "foo@example.com" can't create two
  # accounts for what's really one email — there's no password reset, so a
  # user locked out by a case mismatch would have no way back in.
  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :email, presence: true, uniqueness: true
end
