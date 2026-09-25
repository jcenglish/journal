require "test_helper"

class FilterParameterLoggingTest < ActiveSupport::TestCase
  FILTERED = "[FILTERED]"

  def filter(params)
    ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters).filter(params)
  end

  test "filters every encrypted field in its nested request shape" do
    filtered = filter(
      "entry" => { "content" => "c", "title" => "t", "mood" => "m", "health" => "h", "entry_date" => "2026-09-01" },
      "journal" => { "title" => "t" },
      "tag" => { "content" => "c", "color" => "#fff" }
    )

    assert_equal({ "content" => FILTERED, "title" => FILTERED, "mood" => FILTERED, "health" => FILTERED,
                   "entry_date" => "2026-09-01" }, filtered["entry"])
    assert_equal({ "title" => FILTERED }, filtered["journal"])
    assert_equal({ "content" => FILTERED, "color" => "#fff" }, filtered["tag"])
  end

  test "does not sweep in unrelated params that share a name" do
    filtered = filter("title" => "page title", "report" => { "content" => "x" })

    assert_equal "page title", filtered["title"]
    assert_equal({ "content" => "x" }, filtered["report"])
  end

  test "still filters credentials" do
    filtered = filter("session" => { "email" => "a@b.c", "password" => "p" })

    assert_equal({ "email" => FILTERED, "password" => FILTERED }, filtered["session"])
  end

  test "keeps encrypted columns out of SQL logs and #inspect" do
    %w[content title mood health].each do |column|
      assert_equal FILTERED, ActiveRecord::Base.inspection_filter.filter_param(column, "ciphertext"),
        "expected #{column} to be filtered"
    end

    assert_no_match(/ciphertext-content-one/, entries(:one).inspect)
  end
end
