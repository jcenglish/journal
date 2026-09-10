class User < ApplicationRecord
  has_secure_password

  has_many :journals, dependent: :destroy
  has_many :tags, dependent: :destroy

  # Normalize so "Foo@example.com" and "foo@example.com" can't create two
  # accounts for what's really one email — there's no password reset, so a
  # user locked out by a case mismatch would have no way back in.
  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :email, presence: true, uniqueness: true

  # Generated and wrapped in the browser during signup, so it should always be
  # present. Validating it means a request that omits it fails as a 422 rather
  # than surfacing the NOT NULL violation as a 500.
  validates :encrypted_data_key, presence: true
end
