ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...

    # The plaintext behind every fixture's password_digest. See users.yml for why
    # this isn't really a "password" as far as the backend is concerned.
    FIXTURE_PASSWORD = "password123"

    # Asserts that a raw SQL statement bypassing app validations/callbacks is
    # rejected by a Postgres-level constraint (CHECK, unique index, etc.).
    def assert_db_constraint_violation(sql, matching:)
      error = assert_raises(ActiveRecord::StatementInvalid) do
        ActiveRecord::Base.connection.execute(sql)
      end

      assert_match(matching, error.message)
    end
  end
end

class ActionDispatch::IntegrationTest
  # Logs in over the real endpoint rather than poking session[] directly, so
  # tests exercise the same path the browser takes.
  def sign_in_as(user, password: ActiveSupport::TestCase::FIXTURE_PASSWORD)
    post session_path, params: { session: { email: user.email, password: password } }, as: :json
  end
end
