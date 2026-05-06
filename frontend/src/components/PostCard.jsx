import { useState } from "react";
import API from "../api";
import Icon from "./Icon";

const PostCard = ({ post }) => {
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments?.length || 0);

  const username = post.user || "media user";
  const initial = username.charAt(0).toUpperCase() || "M";
  const uploadedAt = post.uploaded_at ? new Date(post.uploaded_at) : null;
  const timeLabel = uploadedAt
    ? uploadedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "Just now";

  const handleLike = async () => {
    try {
      await API.post(`media/like/${post.id}/`);
      setLikes((currentLikes) => (liked ? Math.max(currentLikes - 1, 0) : currentLikes + 1));
      setLiked((currentLiked) => !currentLiked);
    } catch (err) {
      console.error(err);
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) {
      return;
    }

    try {
      await API.post(`media/comment/${post.id}/`, {
        text: comment.trim(),
      });
      setComment("");
      setCommentsCount((currentCount) => currentCount + 1);
      setShowComment(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}/feed#post-${post.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <article
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
      id={`post-${post.id}`}
    >
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{username}</p>
            <p className="text-xs text-slate-500">{timeLabel}</p>
          </div>
        </div>

        <button
          aria-label="More options"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          type="button"
        >
          <Icon name="more" />
        </button>
      </header>

      <div className="aspect-[4/5] bg-slate-100">
        {post.media_type === "image" ? (
          <img alt="" className="h-full w-full object-cover" src={post.file} />
        ) : (
          <video className="h-full w-full object-cover" controls>
            <source src={post.file} />
          </video>
        )}
      </div>

      <footer className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${
              liked
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={handleLike}
            type="button"
          >
            <Icon name="heart" className="h-4 w-4" />
            <span>{likes}</span>
          </button>

          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700"
            onClick={() => setShowComment((current) => !current)}
            type="button"
          >
            <Icon name="message" className="h-4 w-4" />
            <span>{commentsCount}</span>
          </button>

          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700"
            onClick={handleShare}
            type="button"
          >
            <Icon name="share" className="h-4 w-4" />
            <span>Share</span>
          </button>
        </div>

        {showComment && (
          <div className="flex gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a comment"
              value={comment}
            />
            <button
              className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white"
              onClick={handleComment}
              type="button"
            >
              Post
            </button>
          </div>
        )}
      </footer>
    </article>
  );
};

export default PostCard;
