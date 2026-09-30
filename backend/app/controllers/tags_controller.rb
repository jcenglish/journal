class TagsController < ApplicationController
  # Always scoped through current_user, never a bare Tag.find — see CLAUDE.md's
  # Security & encryption. content is ciphertext; the server never sees or
  # validates what's inside it. color is the only plaintext field.
  def index
    render json: current_user.tags.order(:created_at).map { |tag| tag_json(tag) }
  end

  def create
    tag = current_user.tags.new(tag_params)

    if tag.save
      render json: tag_json(tag), status: :created
    else
      render json: { errors: tag.errors.full_messages }, status: :unprocessable_content
    end
  end

  private
    def tag_params
      params.require(:tag).permit(:content, :color)
    end

    def tag_json(tag)
      { id: tag.id, content: tag.content, color: tag.color, created_at: tag.created_at }
    end
end
