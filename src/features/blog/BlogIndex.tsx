import { Link } from 'react-router-dom';
import { BLOG_POSTS, formatBlogDate } from './posts';
import './Blog.css';

export default function BlogIndex() {
  return (
    <div className="blog-page">
      <header className="blog-header">
        <Link to="/" className="blog-header-logo">Spot</Link>
        <nav className="blog-header-nav">
          <Link to="/">Home</Link>
          <Link to="/auth">Sign In</Link>
        </nav>
      </header>

      <main className="blog-index-main">
        <h1 className="blog-index-title">Spot Blog</h1>
        <p className="blog-index-subtitle">
          Strategy, tips, and insights for food creators and restaurant partners.
        </p>

        <div className="blog-posts-grid">
          {BLOG_POSTS.map((post) => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card">
              <div className="blog-card-meta">
                <span className="blog-card-category">{post.category}</span>
                <span className="blog-card-date">{formatBlogDate(post.date)}</span>
                <span className="blog-card-read-time">{post.readTime} min read</span>
              </div>
              <h2 className="blog-card-title">{post.title}</h2>
              <p className="blog-card-excerpt">{post.excerpt}</p>
              <span className="blog-card-cta">Read article &rarr;</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
