class AddEncryptedDataKeyToUsers < ActiveRecord::Migration[8.1]
  def change
    # The user's random 256-bit data key, wrapped client-side with a key derived
    # from their password. Opaque to the server — it is useless without the
    # password, which never reaches us. Storing the wrapped key rather than
    # deriving the data key from the password directly is what makes a future
    # password change, email change, or PBKDF2 iteration bump a re-wrap of this
    # one value instead of re-encrypting every row. See design-decisions.md.
    #
    # null: false with no backfill is safe only because `users` is empty
    # everywhere: this slice introduces signup, so before it there is no way to
    # create an account outside a console. If that ever stops being true, this
    # needs the add-nullable / backfill / change_column_null sequence instead.
    add_column :users, :encrypted_data_key, :string, null: false
  end
end
