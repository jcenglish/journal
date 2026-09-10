class AddEntryIdIndexToTagEntries < ActiveRecord::Migration[8.1]
  def change
    # The composite (tag_id, entry_id) unique index can't serve an
    # entry_id-only lookup (leftmost-prefix rule), and Entry#tag_entries
    # queries by entry_id alone.
    add_index :tag_entries, :entry_id
  end
end
