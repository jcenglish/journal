class JournalsController < ApplicationController
  # Always reached through current_user, never a bare Journal.find — see
  # CLAUDE.md's Security & encryption. title is ciphertext; the server never
  # sees or validates its content, only that something was sent.
  def index
    render json: current_user.journals.order(:created_at).map { |journal| journal_json(journal) }
  end

  def create
    journal = current_user.journals.new(journal_params)

    if journal.save
      render json: journal_json(journal), status: :created
    else
      render json: { errors: journal.errors.full_messages }, status: :unprocessable_content
    end
  end

  private
    def journal_params
      params.require(:journal).permit(:title)
    end

    def journal_json(journal)
      { id: journal.id, title: journal.title, created_at: journal.created_at }
    end
end
