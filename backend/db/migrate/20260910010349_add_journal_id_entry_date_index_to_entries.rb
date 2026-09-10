class AddJournalIdEntryDateIndexToEntries < ActiveRecord::Migration[8.1]
  def change
    # entry_date (not created_at) is what the journal-detail view orders and
    # filters entries by.
    add_index :entries, [ :journal_id, :entry_date ]
  end
end
