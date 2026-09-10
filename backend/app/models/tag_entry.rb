class TagEntry < ApplicationRecord
  belongs_to :tag
  belongs_to :entry

  validates :tag_id, uniqueness: { scope: :entry_id }
  validate :tag_and_entry_belong_to_the_same_user

  private

  # Tags are scoped per user (see Tag), so a tag from one user must never be
  # attachable to another user's entry.
  def tag_and_entry_belong_to_the_same_user
    return if tag.nil? || entry.nil?

    errors.add(:tag, "must belong to the same user as the entry") if tag.user != entry.journal.user
  end
end
