import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import FeedIcon from "../features/feed/FeedIcon";

const PostCard = ({ post }) => {
  const [likes, setLikes] = useState(post.likes_count ?? 0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(post.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const caption = String(post.caption || "").trim();
  const title = String(post.title || "").trim();
  const fileUrl = String(post.file || "").trim();
  const displayName = String(post.user_full_name || post.user || "").trim();
  const profilePath = post.user_id ? "/profile/" + post.user_id : null;
  const uploadedAt = post.uploaded_at ? new Date(post.uploaded_at) : null;
  const timeLabel = uploadedAt && !Number.isNaN(uploadedAt.getTime())
    ? uploadedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: uploadedAt.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) : "";

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const escape = (event) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    setFeedback(null);
    try {
      const { data } = await API.post("media/like/" + post.id + "/");
      const nowLiked = data.message === "Liked";
      setLikes((value) => nowLiked ? value + 1 : Math.max(value - 1, 0));
      setLiked(nowLiked);
    } catch {
      setFeedback({ error: true, text: "Could not update this like. Please try again." });
    } finally { setLiking(false); }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!comment.trim() || commenting) return;
    setCommenting(true);
    setFeedback(null);
    try {
      const { data } = await API.post("media/comment/" + post.id + "/", { text: comment.trim() });
      setComments((current) => [...current, data]);
      setComment("");
    } catch {
      setFeedback({ error: true, text: "Could not post your comment. Please try again." });
    } finally { setCommenting(false); }
  };

  const handleShare = async (copyOnly = false) => {
    setMenuOpen(false);
    setFeedback(null);
    const url = window.location.origin + "/feed#post-" + post.id;
    try {
      if (!copyOnly && navigator.share) await navigator.share({ text: caption, url });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback({ text: "Post link copied." });
      } else setFeedback({ text: "Post link: " + url });
    } catch (error) {
      if (error.name !== "AbortError") setFeedback({ error: true, text: "Could not share this post. Please try again." });
    }
  };

  const author = <>
    <span className="feed-avatar">{post.user_profile_picture
      ? <img alt="" src={post.user_profile_picture} />
      : displayName.charAt(0).toUpperCase() || <FeedIcon name="user" />}</span>
    <span className="feed-author-copy">
      {displayName && <span className="feed-author-name block">{displayName}</span>}
      {timeLabel && <time className="feed-date" dateTime={post.uploaded_at}>{timeLabel}</time>}
    </span>
  </>;

  return <article className="feed-card" id={"post-" + post.id}>
    <header className="feed-author-header">
      {profilePath ? <Link className="feed-author" to={profilePath}>{author}</Link> : <div className="feed-author">{author}</div>}
      <div className="feed-menu" ref={menuRef}>
        <button aria-label="Post options" aria-expanded={menuOpen} className="feed-more" onClick={() => setMenuOpen((value) => !value)} ref={menuButtonRef} type="button"><FeedIcon name="more" /></button>
        {menuOpen && <div className="feed-menu-panel">
          {profilePath && <Link onClick={() => setMenuOpen(false)} to={profilePath}>View profile</Link>}
          <button onClick={() => handleShare(true)} type="button">Copy post link</button>
        </div>}
      </div>
    </header>

    {post.content_type === "news" && <div className="feed-news"><span>NEWS</span>{title && <h2>{title}</h2>}</div>}
    {fileUrl && <div className="feed-media">
      {post.media_type === "image" ? <img alt={title || caption} src={fileUrl} />
        : <video controls playsInline preload="metadata"><source src={fileUrl} /></video>}
    </div>}

    <footer className="feed-footer">
      <div className="feed-actions">
        <button aria-label={liked ? "Unlike post" : "Like post"} aria-pressed={liked} className="feed-action feed-like" disabled={liking} onClick={handleLike} type="button"><FeedIcon filled={liked} name="heart" /><span>{likes}</span></button>
        <button aria-label="Comment on post" aria-expanded={showComments} className="feed-action" onClick={() => setShowComments((value) => !value)} type="button"><FeedIcon name="message" /><span>{comments.length}</span></button>
        <button aria-label="Share post" className="feed-action" onClick={() => handleShare()} type="button"><FeedIcon name="send" /></button>
        <button aria-label="Save post — unavailable" title="Saving posts is not available yet" className="feed-action feed-bookmark" onClick={() => setFeedback({ text: "Saving posts is not available yet." })} type="button"><FeedIcon name="bookmark" /></button>
      </div>
      {caption && <p className="feed-caption">
        {displayName && (profilePath ? <Link className="feed-caption-author" to={profilePath}>{displayName}</Link> : <strong className="feed-caption-author">{displayName}</strong>)}{caption}
      </p>}
      {comments.length > 0 && <button className="feed-comments-link" onClick={() => setShowComments(true)} type="button">View all {comments.length} {comments.length === 1 ? "comment" : "comments"}<FeedIcon name="chevron" /></button>}
      {showComments && <>
        <div aria-label="Comments" className="feed-comments">
          {comments.length ? comments.map((item) => <p className="feed-comment-entry" key={item.id}><strong>{item.user}</strong>{item.text}</p>) : <p>No comments yet.</p>}
        </div>
        <form className="feed-comment-form" onSubmit={handleComment}>
          <input aria-label="Comment" onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" value={comment} />
          <button disabled={commenting || !comment.trim()} type="submit">{commenting ? "Posting…" : "Post"}</button>
        </form>
      </>}
      {feedback && <p className="feed-feedback" role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
    </footer>
  </article>;
};

export default PostCard;
