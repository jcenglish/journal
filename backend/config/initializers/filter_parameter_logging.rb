# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  # Entry.content, Entry.title, Entry.mood, Entry.health, Journal.title, and Tag.content are all
  # zero-knowledge, client-side encrypted — the server must never log ciphertext-adjacent request
  # data for any of them. (The filter matches by param key regardless of model, so this also
  # catches e.g. Tag#content and Journal#title — intentional, not collateral, since both are
  # encrypted too now; see CLAUDE.md's Security & encryption section.)
  :content, :title, :mood, :health
]
