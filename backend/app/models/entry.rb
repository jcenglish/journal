class Entry < ApplicationRecord
  belongs_to :journal

  has_many :tag_entries, dependent: :destroy
  has_many :tags, through: :tag_entries

  validates :content, presence: true
  # mood/health hold client-side encrypted ciphertext — the server never sees the
  # plaintext 1-5 rating, so it can't range-check it. The 1-5 constraint is
  # enforced client-side only, before encryption. See CLAUDE.md's Guardrails.
  validates :mood, :health, presence: true
  validates :entry_date, presence: true

  delegate :user, to: :journal
end
