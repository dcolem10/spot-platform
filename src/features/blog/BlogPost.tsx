import { Link, useParams } from 'react-router-dom';
import { getPostBySlug, formatBlogDate, BLOG_POSTS } from './posts';
import './Blog.css';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return (
      <div className="blog-page">
        <header className="blog-header">
          <Link to="/" className="blog-header-logo">Spot</Link>
          <nav className="blog-header-nav">
            <Link to="/blog">Blog</Link>
            <Link to="/auth">Sign In</Link>
          </nav>
        </header>
        <main className="blog-post-main">
          <div className="blog-not-found">
            <h1>Post not found</h1>
            <p>This article doesn't exist or may have been moved.</p>
            <Link to="/blog" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
              &larr; Back to Blog
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="blog-page">
      <header className="blog-header">
        <Link to="/" className="blog-header-logo">Spot</Link>
        <nav className="blog-header-nav">
          <Link to="/blog">Blog</Link>
          <Link to="/auth">Sign In</Link>
        </nav>
      </header>

      <main className="blog-post-main">
        <Link to="/blog" className="blog-post-back">&larr; All posts</Link>

        <div className="blog-post-meta">
          <span className="blog-card-category">{post.category}</span>
          <span className="blog-card-date">{formatBlogDate(post.date)}</span>
          <span className="blog-card-read-time">{post.readTime} min read</span>
        </div>

        <h1 className="blog-post-title">{post.title}</h1>
        <p className="blog-post-excerpt">{post.excerpt}</p>

        <div
          className="blog-post-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {relatedPosts.length > 0 && (
          <footer className="blog-post-footer">
            <h3 className="blog-post-footer-title">More from the blog</h3>
            <div className="blog-posts-grid">
              {relatedPosts.map((related) => (
                <Link key={related.slug} to={`/blog/${related.slug}`} className="blog-card">
                  <div className="blog-card-meta">
                    <span className="blog-card-category">{related.category}</span>
                    <span className="blog-card-date">{formatBlogDate(related.date)}</span>
                  </div>
                  <h2 className="blog-card-title" style={{ fontSize: 'var(--font-lg)' }}>
                    {related.title}
                  </h2>
                  <span className="blog-card-cta">Read &rarr;</span>
                </Link>
              ))}
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
