import { useEffect, useRef, useState } from "react";
import API from "../api";
import { getApiErrorMessage } from "../utils/apiError";
import Icon from "./Icon";

const MAX_FILES = 10;
const MAX_CAPTION_LENGTH = 2200;
const MAX_NEWS_LENGTH = 10000;

const CreatePostModal = ({ mode = "all", onClose, onCreated, open }) => {
  const [selections, setSelections] = useState([]);
  const [caption, setCaption] = useState("");
  const [contentType, setContentType] = useState("post");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const selectionsRef = useRef([]);
  const acceptsVideoOnly = mode === "video";
  const isNews = !acceptsVideoOnly && contentType === "news";
  const canPublish = isNews
    ? Boolean(title.trim()) && caption.trim().length >= 40 && selections.length <= 1
    : selections.length > 0 || (!acceptsVideoOnly && Boolean(caption.trim()));

  const clearSelections = () => {
    selectionsRef.current.forEach((selection) => URL.revokeObjectURL(selection.previewUrl));
    selectionsRef.current = [];
    setSelections([]);
  };

  useEffect(() => () => {
    selectionsRef.current.forEach((selection) => URL.revokeObjectURL(selection.previewUrl));
  }, []);

  if (!open) {
    return null;
  }

  const resetAndClose = () => {
    if (uploading) {
      return;
    }

    clearSelections();
    setCaption("");
    setContentType("post");
    setTitle("");
    setError("");
    onClose();
  };

  const selectFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setError("");

    if (files.length > MAX_FILES) {
      setError(`Select no more than ${MAX_FILES} photos.`);
      return;
    }

    if (files.length > 1 && files.some((file) => !file.type.startsWith("image/"))) {
      setError("Multiple selection supports photos only.");
      return;
    }

    if (mode === "video" && files.some((file) => file.type !== "video/mp4")) {
      setError("Select one MP4 video.");
      return;
    }

    clearSelections();
    const nextSelections = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    selectionsRef.current = nextSelections;
    setSelections(nextSelections);
  };

  const publish = async () => {
    const normalizedCaption = caption.trim();
    if (uploading || !canPublish) {
      setError(
        isNews
          ? "Add a headline and at least 40 characters of article text."
          : acceptsVideoOnly
          ? "Select a video to publish."
          : "Write something or select media to publish."
      );
      return;
    }

    const data = new FormData();
    data.append("content_type", isNews ? "news" : "post");
    if (isNews) {
      data.append("title", title.trim());
    }
    if (normalizedCaption) {
      data.append("caption", normalizedCaption);
    }

    if (selections.length === 1) {
      data.append("file", selections[0].file);
    } else {
      selections.forEach(({ file }) => data.append("files", file));
    }

    try {
      setUploading(true);
      setError("");
      const response = await API.post("media/upload/", data);
      const createdItems = response.data.results || [response.data];
      onCreated(createdItems);
      clearSelections();
      setCaption("");
      setContentType("post");
      setTitle("");
      onClose();
    } catch (uploadError) {
      if (uploadError.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.assign("/");
        return;
      }

      setError(
        getApiErrorMessage(
          uploadError.response?.data,
          uploadError.request && !uploadError.response
            ? "Cannot reach the upload server."
            : "Upload failed. Please try again."
        )
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
      <section
        aria-labelledby="create-post-title"
        aria-modal="true"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-card"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-5">
          <button
            aria-label="Close create post"
            className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-slate-100 hover:text-ink"
            disabled={uploading}
            onClick={resetAndClose}
            type="button"
          >
            <Icon name="x" />
          </button>
          <h2 className="text-lg font-extrabold tracking-tight text-ink" id="create-post-title">
            {isNews ? "Create news article" : "Create post"}
          </h2>
          <button
            className="h-10 rounded-full bg-charcoal px-4 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={uploading || !canPublish}
            onClick={publish}
            type="button"
          >
            {uploading ? "Publishing..." : "Publish"}
          </button>
        </header>

        <div className="space-y-5 p-4 sm:p-5">
          {!acceptsVideoOnly && (
            <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1" aria-label="Content type">
              <button
                className={`rounded-full px-3 py-2.5 text-sm font-semibold transition ${!isNews ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"}`}
                disabled={uploading}
                onClick={() => {
                  setContentType("post");
                  setTitle("");
                  setError("");
                }}
                type="button"
              >
                Social post
              </button>
              <button
                className={`rounded-full px-3 py-2.5 text-sm font-semibold transition ${isNews ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"}`}
                disabled={uploading}
                onClick={() => {
                  setContentType("news");
                  if (selections.length > 1) {
                    clearSelections();
                  }
                  setError("");
                }}
                type="button"
              >
                News article
              </button>
            </div>
          )}

          {isNews && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink" htmlFor="news-title">
                Headline
              </label>
              <input
                className="h-12 w-full rounded-control border border-line bg-slate-50 px-4 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
                disabled={uploading}
                id="news-title"
                maxLength={300}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                placeholder="Write a clear, factual headline"
                value={title}
              />
            </div>
          )}

          <div>
            <label className={isNews ? "mb-2 block text-sm font-semibold text-ink" : "sr-only"} htmlFor="post-caption">
              {isNews ? "Article" : "Post text or caption"}
            </label>
            <textarea
              className={`${isNews ? "min-h-56" : "min-h-32"} w-full resize-none rounded-control border border-line bg-slate-50 p-4 text-sm leading-6 text-ink outline-none transition placeholder:text-subtle focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/70`}
              disabled={uploading}
              id="post-caption"
              maxLength={isNews ? MAX_NEWS_LENGTH : MAX_CAPTION_LENGTH}
              onChange={(event) => {
                setCaption(event.target.value);
                setError("");
              }}
              placeholder={isNews ? "Write the article and include sources where possible" : acceptsVideoOnly ? "Add a caption" : "Write something or add a caption"}
              value={caption}
            />
            <p className="mt-1.5 text-right text-xs text-muted">
              {caption.length}/{isNews ? MAX_NEWS_LENGTH : MAX_CAPTION_LENGTH}
            </p>
          </div>

          {selections.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {selections.map(({ file, previewUrl }) => (
                <div className="relative aspect-square overflow-hidden rounded-media bg-slate-100" key={`${file.name}-${file.lastModified}`}>
                  {file.type.startsWith("image/") ? (
                    <img alt="Selected preview" className="h-full w-full object-cover" src={previewUrl} />
                  ) : (
                    <div className="grid h-full place-items-center bg-slate-950 text-white">
                      <div className="text-center">
                        <Icon className="mx-auto h-8 w-8" name="video" />
                        <p className="mt-2 max-w-36 truncate text-xs">{file.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-slate-50 px-4 text-sm font-semibold text-ink transition hover:bg-slate-100">
            <Icon name={acceptsVideoOnly ? "video" : "image"} />
            <span>{acceptsVideoOnly ? "Select video" : "Select photos or video"}</span>
            <input
              accept={acceptsVideoOnly ? "video/mp4" : "image/jpeg,image/png,video/mp4"}
              className="hidden"
              disabled={uploading}
              multiple={!acceptsVideoOnly && !isNews}
              onChange={selectFiles}
              type="file"
            />
          </label>

          {selections.length > 1 && (
            <p className="text-sm text-muted">{selections.length} photos selected</p>
          )}

          {error && (
            <p className="rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default CreatePostModal;
