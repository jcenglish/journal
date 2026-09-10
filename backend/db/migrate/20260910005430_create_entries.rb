class CreateEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :entries do |t|
      t.text :content, null: false
      t.string :title
      t.integer :mood, null: false
      t.integer :health, null: false
      t.date :entry_date, null: false
      t.references :journal, null: false, foreign_key: true

      t.timestamps
    end

    add_check_constraint :entries, "mood BETWEEN 1 AND 5", name: "mood_range_check"
    add_check_constraint :entries, "health BETWEEN 1 AND 5", name: "health_range_check"
  end
end
