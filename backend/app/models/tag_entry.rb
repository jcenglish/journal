class TagEntry < ApplicationRecord
  belongs_to :tag
  belongs_to :entry

  validates :tag_id, uniqueness: { scope: :entry_id }
end
