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
    entry = @journal.entries.new(entry_params.except(:tag_ids))
    entry.tags = tags_for(entry_params[:tag_ids])

    if entry.save
      render json: entry_json(entry), status: :created
    else
      render json: { errors: entry.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    entry = @journal.entries.find(params[:id])

    # entry.tags= on an already-persisted entry writes tag_entries rows
    # immediately, independent of entry.save — wrapped in a transaction and
    # rolled back on a failed save so a 422 response never leaves tag changes
    # committed behind it.
    ActiveRecord::Base.transaction do
      entry.assign_attributes(entry_params.except(:tag_ids))
      entry.tags = tags_for(entry_params[:tag_ids]) if entry_params.key?(:tag_ids)
      raise ActiveRecord::Rollback unless entry.save
    end

    if entry.errors.empty?
      render json: entry_json(entry)
    else
      render json: { errors: entry.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    @journal.entries.find(params[:id]).destroy!
    head :no_content
  end

  private
    def set_journal
      @journal = current_user.journals.find(params[:journal_id])
    end

    def entry_params
      params.require(:entry).permit(:title, :content, :mood, :health, :entry_date, tag_ids: [])
    end

    # Tags are scoped per user (see CLAUDE.md's Security & encryption) — looking
    # up by bare id without this scope would let a request attach another
    # user's tag to one of ours.
    def tags_for(tag_ids)
      current_user.tags.where(id: tag_ids || [])
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
        tag_ids: entry.tag_ids,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      }
    end
end
