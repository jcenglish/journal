require "test_helper"

class ApiNotFoundTest < ActionDispatch::IntegrationTest
  test "unknown api path returns a JSON 404 even for an HTML Accept header" do
    get "/api/does-not-exist", headers: { "Accept" => "text/html" }

    assert_response :not_found
    assert_equal "application/json", response.media_type
    assert_equal({ "error" => "Not Found" }, response.parsed_body)
  end

  test "unknown api write returns a JSON 404 without requiring a JSON body" do
    post "/api/does-not-exist", params: "a=b"

    assert_response :not_found
    assert_equal({ "error" => "Not Found" }, response.parsed_body)
  end
end
