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
