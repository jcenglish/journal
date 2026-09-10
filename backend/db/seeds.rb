# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Deliberately empty of users. A seeded account would be un-login-able from the
# UI: the browser never sends the password, it sends a base64 auth hash derived
# from it, so there is no plaintext password a seed file could set that the
# login screen could reproduce. Sign up through the UI instead.
