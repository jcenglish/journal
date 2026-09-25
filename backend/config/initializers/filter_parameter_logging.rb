# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  # The zero-knowledge, client-side encrypted fields (see CLAUDE.md's Security & encryption).
  # Dotted keys match the full nested path of the request body (bodies are always explicitly
  # nested — see ApplicationController), so an unrelated future `title` param isn't swept in.
  "entry.content", "entry.title", "entry.mood", "entry.health", "journal.title", "tag.content"
]

# Active Record builds its SQL-log bind filter and #inspect filter from the list above, but
# matches only bare column names — a dotted key never matches there. Without these, entry
# ciphertext would appear in SQL logs.
ActiveSupport.on_load(:active_record) do
  self.filter_attributes += %i[content title mood health]
end
