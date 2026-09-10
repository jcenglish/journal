class RemoveRedundantJournalIdIndexFromEntries < ActiveRecord::Migration[8.1]
  def change
    # The (journal_id, entry_date) composite index added in the prior
    # migration serves plain journal_id lookups via its leftmost prefix,
    # making this single-column index (auto-created by t.references) redundant.
    remove_index :entries, :journal_id
  end
end
