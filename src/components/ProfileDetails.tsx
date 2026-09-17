import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  Github,
  Heart,
  Home,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { MapProfile } from "./FreelancerMap";

type Comment = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
};

type PortfolioItem = { id: string; title: string; description: string; image_url: string };

export function ProfileDetails({
  profile,
  viewerId,
  isFavorite,
  onToggleFavorite,
  onClose,
  onRequireSignIn,
}: {
  profile: MapProfile;
  viewerId: string | null;
  isFavorite: boolean;
  onToggleFavorite: (profile: MapProfile) => void;
  onClose: () => void;
  onRequireSignIn: () => void;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [myVote, setMyVote] = useState<1 | -1 | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);


  const loadReactions = useCallback(async () => {
    const { data } = await supabase.from("profile_reactions").select("user_id,value").eq("profile_id", profile.id);
    const rows = data ?? [];
    setLikes(rows.filter((row) => row.value === 1).length);
    setDislikes(rows.filter((row) => row.value === -1).length);
    const mine = viewerId ? rows.find((row) => row.user_id === viewerId) : undefined;
    setMyVote(mine ? ((mine.value === 1 ? 1 : -1) as 1 | -1) : null);
  }, [profile.id, viewerId]);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("profile_comments")
      .select("id,author_id,body,created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const authors = authorIds.length
      ? (await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", authorIds)).data ?? []
      : [];
    setComments(
      rows.map((row) => {
        const author = authors.find((entry) => entry.id === row.author_id);
        return {
          ...row,
          author_name: author?.full_name || (author?.username ? `@${author.username}` : "Someone"),
          author_avatar: author?.avatar_url ?? null,
        };
      }),
    );
  }, [profile.id]);

  useEffect(() => {
    setShowPortfolio(false);
    void supabase
      .from("portfolio_items")
      .select("id,title,description,image_url")
      .eq("profile_id", profile.id)
      .order("sort_order")
      .then(({ data }) => setPortfolio(data ?? []));
    void loadReactions();
    void loadComments();
  }, [profile.id, loadReactions, loadComments]);


  async function vote(value: 1 | -1) {
    if (!viewerId) { onRequireSignIn(); return; }
    if (myVote === value) {
      const { error } = await supabase.from("profile_reactions").delete().eq("profile_id", profile.id).eq("user_id", viewerId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from("profile_reactions")
        .upsert({ profile_id: profile.id, user_id: viewerId, value }, { onConflict: "profile_id,user_id" });
      if (error) { toast.error(error.message); return; }
    }
    void loadReactions();
  }

  async function postComment() {
    if (!viewerId) { onRequireSignIn(); return; }
    const body = draft.trim();
    if (!body) { toast.error("Write something first."); return; }
    if (body.length > 1000) { toast.error("Keep your comment under 1000 characters."); return; }
    setPosting(true);
    const { error } = await supabase.from("profile_comments").insert({ profile_id: profile.id, author_id: viewerId, body });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    void loadComments();
  }

  async function removeComment(id: string) {
    const { error } = await supabase.from("profile_comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void loadComments();
  }

  const contacts: { key: string; icon: ReactNode; label: string; href: string }[] = [];
  if (profile.contact_email) contacts.push({ key: "email", icon: <Mail size={14} />, label: profile.contact_email, href: `mailto:${profile.contact_email}` });
  if (profile.linkedin_url) contacts.push({ key: "linkedin", icon: <Linkedin size={14} />, label: "LinkedIn", href: normalizeUrl(profile.linkedin_url) });
  if (profile.instagram_url) contacts.push({ key: "instagram", icon: <Instagram size={14} />, label: "Instagram", href: normalizeUrl(profile.instagram_url) });
  if (profile.whatsapp_number) contacts.push({ key: "whatsapp", icon: <MessageCircle size={14} />, label: "WhatsApp", href: `https://wa.me/${profile.whatsapp_number.replace(/[^\d]/g, "")}` });
  if (profile.telegram_id) contacts.push({ key: "telegram", icon: <Send size={14} />, label: "Telegram", href: `https://t.me/${profile.telegram_id.replace(/^@/, "")}` });

  return (
    <aside className="detail-panel" aria-label={`${profile.full_name || profile.username} profile`}>
      <div className="detail-cover">
        <Button className="detail-close" variant="secondary" size="icon" onClick={onClose} aria-label="Close details"><X /></Button>
        {profile.avatar_url && <img className="detail-avatar" src={profile.avatar_url} alt={`${profile.full_name} profile`} referrerPolicy="no-referrer" />}
      </div>
      <div className="detail-body">
        <span className="eyebrow">{profile.is_available ? "Available for work" : "Currently booked"}</span>
        <div className="detail-title">
          <h2>{profile.full_name || `@${profile.username}`}</h2>
          <Button
            variant={isFavorite ? "default" : "outline"}
            size="sm"
            onClick={() => (viewerId ? onToggleFavorite(profile) : onRequireSignIn())}
          >
            <Heart />{isFavorite ? "Saved" : "Save"}
          </Button>
        </div>
        <p>{profile.headline}</p>
        <div className="detail-meta">
          <span><MapPin size={14} />{profile.location_name || "Pinned location"}</span>
          {profile.starting_price != null && <span><BriefcaseBusiness size={14} />From {profile.currency} {profile.starting_price}</span>}
        </div>
        {profile.show_address && profile.address && (
          <div className="detail-address"><Home size={14} /><span>{profile.address}</span></div>
        )}
        <div className="tag-list">{[...profile.services, ...profile.tags].map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>

        <div className="reaction-row">
          <button type="button" className="reaction reaction-like" data-active={myVote === 1} onClick={() => void vote(1)} aria-label="Like this profile"><ThumbsUp size={15} />{likes}</button>
          <button type="button" className="reaction reaction-dislike" data-active={myVote === -1} onClick={() => void vote(-1)} aria-label="Dislike this profile"><ThumbsDown size={15} />{dislikes}</button>
        </div>

        <h3>About</h3>
        <p>{profile.bio || "This freelancer is ready to collaborate."}</p>

        {contacts.length > 0 && (
          <>
            <h3>Get in touch</h3>
            <div className="link-stack">
              {contacts.map((contact) => (
                <a key={contact.key} className="link-row" href={contact.href} target="_blank" rel="noreferrer noopener">
                  <span className="link-row-icon">{contact.icon}</span>
                  <span className="link-row-copy"><strong>{contact.title}</strong><span>{contact.label}</span></span>
                  <ChevronRight size={16} className="link-row-arrow" />
                </a>
              ))}
            </div>
          </>
        )}

        {profile.github_repos.length > 0 && (
          <>
            <h3>Code</h3>
            <div className="link-stack">
              {profile.github_repos.map((repo) => (
                <a key={repo} className="link-row" href={normalizeUrl(repo)} target="_blank" rel="noreferrer noopener">
                  <span className="link-row-icon"><Github size={16} /></span>
                  <span className="link-row-copy"><strong>GitHub</strong><span>{repo.replace(/^https?:\/\/(www\.)?github\.com\//, "")}</span></span>
                  <ChevronRight size={16} className="link-row-arrow" />
                </a>
              ))}
            </div>
          </>
        )}


        <h3>Project portfolio</h3>
        <button type="button" className="link-row link-row-action" onClick={() => setShowPortfolio((open) => !open)} aria-expanded={showPortfolio}>
          <span className="link-row-icon"><FolderOpen size={16} /></span>
          <span className="link-row-copy"><strong>{showPortfolio ? "Hide projects" : "View projects"}</strong><span>{portfolio.length ? `${portfolio.length} project${portfolio.length > 1 ? "s" : ""} with images` : "No projects added yet"}</span></span>
          <ChevronRight size={16} className="link-row-arrow" data-open={showPortfolio} />
        </button>
        {showPortfolio && (
          portfolio.length ? (
            <div className="portfolio-grid">
              {portfolio.map((item) => (
                <figure key={item.id}>
                  <img src={item.image_url} alt={item.title} loading="lazy" />
                  <figcaption>{item.title}</figcaption>
                  {item.description && <p className="portfolio-note">{item.description}</p>}
                </figure>
              ))}
            </div>
          ) : (
            <p>This freelancer has not uploaded any project images yet.</p>
          )
        )}


        <h3>Comments</h3>
        <div className="comment-form">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={1000} placeholder={viewerId ? "Share your experience..." : "Sign in to leave a comment"} disabled={!viewerId} />
          <Button size="sm" disabled={posting || !viewerId} onClick={() => void postComment()}>{posting ? "Posting..." : "Post comment"}</Button>
        </div>
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div className="comment-head">
                <strong>{comment.author_name}</strong>
                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                {(comment.author_id === viewerId || profile.id === viewerId) && (
                  <button type="button" onClick={() => void removeComment(comment.id)} aria-label="Delete comment"><Trash2 size={13} /></button>
                )}
              </div>
              <p>{comment.body}</p>
            </li>
          ))}
          {!comments.length && <li className="comment-empty">No comments yet.</li>}
        </ul>
      </div>
    </aside>
  );
}

function normalizeUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
