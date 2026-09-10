class CreateTagEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :tag_entries do |t|
      t.references :tag, null: false, foreign_key: true, index: false
      t.references :entry, null: false, foreign_key: true, index: false

      t.timestamps
    end

    add_index :tag_entries, [ :tag_id, :entry_id ], unique: true
  end
end
