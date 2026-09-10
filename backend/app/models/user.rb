class User < ApplicationRecord
  has_secure_password

  has_many :journals, dependent: :destroy
  has_many :tags, dependent: :destroy

  validates :email, presence: true, uniqueness: true
end
