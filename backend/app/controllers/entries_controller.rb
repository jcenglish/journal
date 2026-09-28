class EntriesController < ApplicationController
  PER_PAGE = 20
  # Far beyond any real journal, but keeps the OFFSET well inside bigint.
  MAX_PAGE = 1_000_000

  # The journal is always looked up through current_user, and entries through
  # that journal — never a bare Entry.find. See CLAUDE.md's Security & encryption.
  # content, title, mood, and health are ciphertext; the server never sees or
  # validates what's inside them.
  before_action :set_journal

  def index
    page = params[:page].to_i.clamp(1, MAX_PAGE)
    # One extra row tells us whether another page exists without a COUNT query.
    entries = @journal.entries
      .order(entry_date: :desc, id: :desc)
      .offset((page - 1) * PER_PAGE)
      .limit(PER_PAGE + 1)
      .to_a

    render json: {
      entries: entries.first(PER_PAGE).map { |entry| entry_summary_json(entry) },
      next_page: entries.size > PER_PAGE ? page + 1 : nil
    }
  end

  def show
    render json: entry_json(@journal.entries.find(params[:id]))
  end

  def create
    entry = @journal.entries.new(entry_params)

    if entry.save
      render json: entry_json(entry), status: :created
    else
      render json: { errors: entry.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    entry = @journal.entries.find(params[:id])

    if entry.update(entry_params)
      render json: entry_json(entry)
    else
      render json: { errors: entry.errors.full_messages }, status: :unprocessable_content
    end
  end

  private
    def set_journal
      @journal = current_user.journals.find(params[:journal_id])
    end

    def entry_params
      params.require(:entry).permit(:title, :content, :mood, :health, :entry_date)
    end

    def entry_summary_json(entry)
      { id: entry.id, title: entry.title, entry_date: entry.entry_date }
    end

    def entry_json(entry)
      {
        id: entry.id,
        journal_id: entry.journal_id,
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        health: entry.health,
        entry_date: entry.entry_date,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      }
    end
end
