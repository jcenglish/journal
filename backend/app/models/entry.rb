class Entry < ApplicationRecord
  belongs_to :journal

  has_many :tag_entries, dependent: :destroy
  has_many :tags, through: :tag_entries

  validates :content, presence: true
  validates :mood, :health, presence: true, inclusion: { in: 1..5 }
  validates :entry_date, presence: true

  # No fk:user — derive via journal.user to avoid the two drifting out of sync.
  delegate :user, to: :journal
end
