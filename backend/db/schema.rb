# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_10_232152) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "entries", force: :cascade do |t|
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.date "entry_date", null: false
    t.string "health", null: false
    t.bigint "journal_id", null: false
    t.string "mood", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["journal_id", "entry_date"], name: "index_entries_on_journal_id_and_entry_date"
  end

  create_table "journals", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_journals_on_user_id"
  end

  create_table "tag_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "entry_id", null: false
    t.bigint "tag_id", null: false
    t.datetime "updated_at", null: false
    t.index ["entry_id"], name: "index_tag_entries_on_entry_id"
    t.index ["tag_id", "entry_id"], name: "index_tag_entries_on_tag_id_and_entry_id", unique: true
  end

  create_table "tags", force: :cascade do |t|
    t.string "color", null: false
    t.string "content", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_tags_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "encrypted_data_key", null: false
    t.string "password_digest", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "entries", "journals"
  add_foreign_key "journals", "users"
  add_foreign_key "tag_entries", "entries"
  add_foreign_key "tag_entries", "tags"
  add_foreign_key "tags", "users"
end
