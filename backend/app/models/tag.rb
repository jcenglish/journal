class Tag < ApplicationRecord
  belongs_to :user

  has_many :tag_entries, dependent: :destroy
  has_many :entries, through: :tag_entries

  validates :content, presence: true
  validates :color, presence: true
end
