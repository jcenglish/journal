class CreateTags < ActiveRecord::Migration[8.1]
  def change
    create_table :tags do |t|
      t.string :content, null: false
      t.string :color, null: false
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end
