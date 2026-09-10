class CreateEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :entries do |t|
      t.text :content, null: false
      t.string :title
      # mood/health hold client-side encrypted ciphertext, not a plain 1-5 integer —
      # the server never sees the plaintext rating, so no DB-level range check is
      # possible here. See CLAUDE.md's Security & encryption section.
      t.string :mood, null: false
      t.string :health, null: false
      t.date :entry_date, null: false
      t.references :journal, null: false, foreign_key: true

      t.timestamps
    end
  end
end
