class Journal < ApplicationRecord
  belongs_to :user

  has_many :entries, dependent: :destroy

  validates :title, presence: true
end
