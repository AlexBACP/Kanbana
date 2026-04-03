import { useState, useEffect, useRef } from 'react';

// ─── Inline CSS ───────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #05050a;
    --bg-2: #0d0d18;
    --bg-3: #12121f;
    --card: #0f0f1c;
    --card-border: rgba(255,255,255,0.07);
    --accent: #3ecf8e;
    --accent-2: #7c6aff;
    --accent-3: #ff6b6b;
    --accent-gold: #f5c842;
    --text: #f0f0f8;
    --text-muted: #7a7a9a;
    --text-dim: #3a3a5a;
    --ff-display: 'Syne', sans-serif;
    --ff-body: 'Instrument Sans', sans-serif;
    --radius: 20px;
    --radius-sm: 12px;
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--ff-body);
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
  }

  /* ── Grid noise overlay ── */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(62,207,142,0.04) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(124,106,255,0.05) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Nav ── */
  .nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 48px;
    background: rgba(5,5,10,0.7);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--card-border);
    transition: background 0.3s;
  }
  .nav-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--ff-display);
    font-weight: 800;
    font-size: 22px;
    letter-spacing: -0.5px;
    text-decoration: none;
    color: var(--text);
  }
  .nav-logo-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 900; color: #000;
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 32px;
    list-style: none;
  }
  .nav-links a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s;
  }
  .nav-links a:hover { color: var(--text); }
  .nav-cta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-outline {
    padding: 8px 20px;
    border: 1px solid var(--card-border);
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: var(--ff-body);
  }
  .btn-outline:hover { border-color: var(--accent); color: var(--accent); }
  .btn-primary {
    padding: 8px 22px;
    border: none;
    border-radius: 999px;
    background: var(--accent);
    color: #000;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    font-family: var(--ff-body);
  }
  .btn-primary:hover { background: #4de8a0; transform: translateY(-1px); }

  /* ── Section base ── */
  section { position: relative; z-index: 1; }

  /* ── HERO ── */
  .hero {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 120px 24px 80px;
    position: relative;
    overflow: hidden;
  }
  .hero-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(62,207,142,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border: 1px solid rgba(62,207,142,0.3);
    border-radius: 999px;
    background: rgba(62,207,142,0.05);
    color: var(--accent);
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 32px;
    letter-spacing: 0.02em;
  }
  .hero-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  .hero-title {
    font-family: var(--ff-display);
    font-size: clamp(40px, 6vw, 70px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -3px;
    margin-bottom: 24px;
    max-width: 900px;
  }
  .hero-title em {
    font-style: normal;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-sub {
    font-size: clamp(18px, 2.5vw, 22px);
    color: var(--text-muted);
    max-width: 600px;
    margin: 0 auto 48px;
    font-weight: 400;
    line-height: 1.5;
  }
  .hero-form {
    display: flex;
    gap: 12px;
    max-width: 480px;
    width: 100%;
    margin: 0 auto 20px;
  }
  .hero-input {
    flex: 1;
    padding: 14px 20px;
    border: 1px solid var(--card-border);
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    color: var(--text);
    font-size: 15px;
    font-family: var(--ff-body);
    outline: none;
    transition: border-color 0.2s;
  }
  .hero-input::placeholder { color: var(--text-dim); }
  .hero-input:focus { border-color: var(--accent); }
  .btn-hero {
    padding: 14px 28px;
    border: none;
    border-radius: 999px;
    background: var(--accent);
    color: #000;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--ff-body);
    white-space: nowrap;
    transition: all 0.2s;
  }
  .btn-hero:hover { background: #4de8a0; transform: translateY(-1px); }
  .hero-note {
    font-size: 13px;
    color: var(--text-dim);
    margin-bottom: 64px;
  }
  .hero-roles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    max-width: 900px;
    width: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--card-border);
  }
  .hero-role-card {
    background: var(--card);
    padding: 24px 20px;
    text-align: left;
    border: 1px solid var(--card-border);
  }
  .hero-role-tag {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .hero-role-title {
    font-family: var(--ff-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.2;
  }

  /* ── Logos / Trust ── */
  .trust {
    padding: 60px 48px;
    text-align: center;
    border-top: 1px solid var(--card-border);
    border-bottom: 1px solid var(--card-border);
  }
  .trust-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 28px;
  }
  .trust-logos {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 48px;
    flex-wrap: wrap;
  }
  .trust-logo-item {
    font-family: var(--ff-display);
    font-weight: 700;
    font-size: 18px;
    color: var(--text-dim);
    letter-spacing: -0.5px;
    transition: color 0.3s;
  }
  .trust-logo-item:hover { color: var(--text-muted); }

  /* ── Section layout ── */
  .section {
    padding: 120px 48px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .section-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 16px;
  }
  .section-title {
    font-family: var(--ff-display);
    font-size: clamp(36px, 5vw, 60px);
    font-weight: 800;
    letter-spacing: -2px;
    line-height: 1.05;
    margin-bottom: 20px;
  }
  .section-sub {
    font-size: 18px;
    color: var(--text-muted);
    max-width: 560px;
    line-height: 1.6;
  }

  /* ── Superteam section ── */
  .superteam {
    padding: 120px 48px;
    background: var(--bg-2);
    border-top: 1px solid var(--card-border);
    border-bottom: 1px solid var(--card-border);
  }
  .superteam-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }
  .superteam-visual {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 32px;
    position: relative;
    overflow: hidden;
  }
  .superteam-visual::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
  }
  .kanban-preview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .kanban-col-head {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--card-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kanban-count {
    background: var(--card-border);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    color: var(--text-muted);
  }
  .kanban-ticket {
    background: var(--bg-2);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s;
  }
  .kanban-ticket:hover { border-color: var(--accent); transform: translateY(-1px); }
  .kanban-ticket-id {
    font-size: 10px;
    color: var(--accent);
    font-weight: 700;
    margin-bottom: 6px;
    letter-spacing: 0.05em;
  }
  .kanban-ticket-title {
    font-size: 12px;
    color: var(--text);
    font-weight: 500;
    line-height: 1.4;
    margin-bottom: 8px;
  }
  .kanban-ticket-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ticket-priority {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .p-alta { background: rgba(255,107,107,0.15); color: var(--accent-3); }
  .p-media { background: rgba(245,200,66,0.15); color: var(--accent-gold); }
  .p-baja { background: rgba(62,207,142,0.15); color: var(--accent); }
  .ticket-avatar {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-2), var(--accent));
    font-size: 9px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; color: #fff;
  }

  /* ── Features 6-grid ── */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    background: var(--card-border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-top: 60px;
  }
  .feature-card {
    background: var(--card);
    padding: 40px 36px;
    border: 1px solid var(--card-border);
    transition: background 0.3s;
    position: relative;
    overflow: hidden;
  }
  .feature-card:hover { background: var(--bg-2); }
  .feature-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .feature-card:hover::before { opacity: 1; }
  .feature-num {
    font-family: var(--ff-display);
    font-size: 48px;
    font-weight: 800;
    color: var(--text-dim);
    margin-bottom: 20px;
    letter-spacing: -2px;
    line-height: 1;
  }
  .feature-icon {
    width: 48px; height: 48px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    margin-bottom: 20px;
  }
  .feature-title {
    font-family: var(--ff-display);
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }
  .feature-desc {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: 20px;
  }
  .feature-link {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: gap 0.2s;
  }
  .feature-link:hover { gap: 10px; }

  /* ── Integrations ── */
  .integrations-section {
    padding: 120px 48px;
    background: var(--bg-2);
    border-top: 1px solid var(--card-border);
  }
  .integrations-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: start;
  }
  .integration-steps {
    margin-top: 48px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .step-item {
    display: flex;
    gap: 20px;
    padding: 28px 0;
    border-bottom: 1px solid var(--card-border);
    cursor: pointer;
    transition: all 0.2s;
  }
  .step-item:last-child { border-bottom: none; }
  .step-item.active .step-num { background: var(--accent); color: #000; }
  .step-num {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--card-border);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: all 0.3s;
  }
  .step-content { flex: 1; }
  .step-title {
    font-family: var(--ff-display);
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
    letter-spacing: -0.3px;
  }
  .step-desc {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
  }
  .step-cta {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    transition: gap 0.2s;
  }
  .step-cta:hover { gap: 10px; }
  .integration-visual {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 32px;
    position: sticky;
    top: 100px;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .integration-visual::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-2), transparent);
  }
  .visual-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .visual-chat-msg {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .chat-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .chat-avatar-ai { background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #fff; }
  .chat-avatar-user { background: linear-gradient(135deg, var(--accent-3), var(--accent-gold)); color: #fff; }
  .chat-bubble {
    background: var(--bg-2);
    border: 1px solid var(--card-border);
    border-radius: 14px;
    border-top-left-radius: 4px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 260px;
  }
  .chat-bubble strong { color: var(--text); }

  /* ── Roles section ── */
  .roles-section {
    padding: 120px 48px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .roles-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 48px;
    flex-wrap: wrap;
  }
  .role-tab {
    padding: 10px 24px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--card-border);
    background: transparent;
    color: var(--text-muted);
    font-family: var(--ff-body);
    transition: all 0.2s;
  }
  .role-tab.active {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
  }
  .role-tab:hover:not(.active) { color: var(--text); border-color: var(--text-dim); }
  .roles-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
  }
  .role-feature-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 32px;
  }
  .role-feature-item {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .role-feature-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: rgba(62,207,142,0.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .role-feature-text h4 {
    font-family: var(--ff-display);
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .role-feature-text p {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.6;
  }
  .role-dashboard-preview {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .preview-topbar {
    background: var(--bg-2);
    border-bottom: 1px solid var(--card-border);
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .preview-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
  }
  .preview-body {
    padding: 24px 20px;
    display: flex;
    gap: 12px;
  }
  .preview-sidebar {
    width: 120px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .preview-nav-item {
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 11px;
    color: var(--text-dim);
    font-weight: 500;
  }
  .preview-nav-item.active {
    background: rgba(62,207,142,0.1);
    color: var(--accent);
  }
  .preview-main { flex: 1; }
  .preview-stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .preview-stat {
    background: var(--bg-2);
    border: 1px solid var(--card-border);
    border-radius: 10px;
    padding: 10px;
  }
  .preview-stat-num {
    font-family: var(--ff-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--text);
    line-height: 1;
  }
  .preview-stat-label {
    font-size: 9px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }
  .preview-list-item {
    background: var(--bg-2);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .preview-list-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Testimonial ── */
  .testimonial-section {
    padding: 120px 48px;
    background: var(--bg-2);
    border-top: 1px solid var(--card-border);
    border-bottom: 1px solid var(--card-border);
    overflow: hidden;
  }
  .testimonial-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }
  .testimonial-visual {
    position: relative;
  }
  .testimonial-card {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 40px;
    position: relative;
  }
  .testimonial-card::before {
    content: '"';
    position: absolute;
    top: -20px;
    left: 32px;
    font-family: var(--ff-display);
    font-size: 80px;
    color: var(--accent);
    line-height: 1;
  }
  .testimonial-quote {
    font-family: var(--ff-display);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: -0.3px;
    margin-bottom: 24px;
  }
  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .testimonial-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-2), var(--accent));
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 16px; color: #fff;
  }
  .testimonial-author-name {
    font-family: var(--ff-display);
    font-weight: 700;
    font-size: 15px;
  }
  .testimonial-author-role {
    font-size: 13px;
    color: var(--text-muted);
  }
  .testimonial-floating {
    position: absolute;
    bottom: -24px;
    right: -24px;
    background: var(--accent);
    color: #000;
    border-radius: var(--radius-sm);
    padding: 16px 20px;
    font-family: var(--ff-display);
    font-size: 13px;
    font-weight: 700;
    max-width: 200px;
  }
  .testimonial-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .tstat-card {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 28px;
    transition: border-color 0.3s;
  }
  .tstat-card:hover { border-color: var(--accent); }
  .tstat-num {
    font-family: var(--ff-display);
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -2px;
    line-height: 1;
    margin-bottom: 8px;
  }
  .tstat-label {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Award banner ── */
  .award-banner {
    padding: 0 48px;
    background: var(--bg);
  }
  .award-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 48px;
    align-items: center;
    padding: 60px 0;
    border-top: 1px solid var(--card-border);
  }
  .award-badge {
    width: 120px; height: 120px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-2), var(--accent));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 16px;
    flex-shrink: 0;
  }
  .award-badge-title {
    font-family: var(--ff-display);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #000;
  }
  .award-badge-year {
    font-family: var(--ff-display);
    font-size: 22px;
    font-weight: 800;
    color: #000;
  }
  .award-text h3 {
    font-family: var(--ff-display);
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 10px;
  }
  .award-text p {
    font-size: 15px;
    color: var(--text-muted);
    max-width: 600px;
    line-height: 1.6;
  }

  /* ── Collection ── */
  .collection-section {
    padding: 80px 48px;
    background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg) 100%);
    border-top: 1px solid var(--card-border);
  }
  .collection-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
  }
  .collection-icons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .collection-icon-item {
    aspect-ratio: 1;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 28px;
  }
  .collection-icon-item:hover {
    border-color: var(--accent);
    transform: translateY(-4px);
    background: var(--bg-2);
  }
  .collection-icon-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    letter-spacing: 0.02em;
  }

  /* ── CTA Final ── */
  .final-cta {
    padding: 140px 48px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .final-cta::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(62,207,142,0.07) 0%, transparent 70%);
  }
  .final-cta-title {
    font-family: var(--ff-display);
    font-size: clamp(44px, 7vw, 80px);
    font-weight: 800;
    letter-spacing: -3px;
    line-height: 1;
    margin-bottom: 24px;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
    position: relative;
  }
  .final-cta-sub {
    font-size: 18px;
    color: var(--text-muted);
    margin-bottom: 48px;
    position: relative;
  }
  .final-cta-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
    position: relative;
  }
  .btn-final-primary {
    padding: 16px 40px;
    border: none;
    border-radius: 999px;
    background: var(--accent);
    color: #000;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--ff-body);
    transition: all 0.2s;
  }
  .btn-final-primary:hover { background: #4de8a0; transform: translateY(-2px); box-shadow: 0 20px 40px rgba(62,207,142,0.2); }
  .btn-final-outline {
    padding: 16px 40px;
    border: 1px solid var(--card-border);
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--ff-body);
    transition: all 0.2s;
  }
  .btn-final-outline:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Footer ── */
  .footer {
    padding: 60px 48px;
    background: var(--bg);
    border-top: 1px solid var(--card-border);
  }
  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .footer-top {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr;
    gap: 40px;
    margin-bottom: 60px;
  }
  .footer-brand-desc {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.7;
    margin-top: 14px;
  }
  .footer-col-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    margin-bottom: 20px;
  }
  .footer-links {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .footer-links a {
    font-size: 14px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.2s;
  }
  .footer-links a:hover { color: var(--accent); }
  .footer-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 32px;
    border-top: 1px solid var(--card-border);
  }
  .footer-copy {
    font-size: 13px;
    color: var(--text-dim);
  }
  .footer-legal {
    display: flex;
    gap: 24px;
  }
  .footer-legal a {
    font-size: 13px;
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.2s;
  }
  .footer-legal a:hover { color: var(--text-muted); }

  /* ── Animations ── */
  .fade-up {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }
  .fade-up.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .fade-up-delay-1 { transition-delay: 0.1s; }
  .fade-up-delay-2 { transition-delay: 0.2s; }
  .fade-up-delay-3 { transition-delay: 0.3s; }
  .fade-up-delay-4 { transition-delay: 0.4s; }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .nav { padding: 16px 24px; }
    .nav-links { display: none; }
    .section, .superteam, .integrations-section, .roles-section, .testimonial-section, .award-banner, .collection-section, .final-cta, .footer { padding-left: 24px; padding-right: 24px; }
    .superteam-inner, .integrations-inner, .roles-content, .testimonial-inner, .collection-inner { grid-template-columns: 1fr; gap: 48px; }
    .features-grid { grid-template-columns: 1fr 1fr; }
    .hero-roles { grid-template-columns: 1fr 1fr; }
    .footer-top { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 640px) {
    .hero-form { flex-direction: column; }
    .features-grid { grid-template-columns: 1fr; }
    .hero-roles { grid-template-columns: 1fr 1fr; }
    .testimonial-stats { grid-template-columns: 1fr; }
    .award-inner { grid-template-columns: 1fr; }
    .footer-top { grid-template-columns: 1fr; }
    .roles-tabs { gap: 6px; }
    .collection-icons { grid-template-columns: repeat(2, 1fr); }
  }
`;

// ─── Data ────────────────────────────────────────────────────────────────────
// src/pages/LandingPage.tsx
import { useNavigate } from 'react-router-dom'; // ✅ CAMBIO: Añadido useNavigate
import { useAuthStore } from '../store/auth.store'; // ✅ CAMBIO: Importamos tu store de Zustand
import { LayoutDashboard, LogOut, ArrowRight, CheckCircle2 } from 'lucide-react'; // ✅ CAMBIO: Iconos para la versión logueada

const KANBAN_TICKETS = [
  { id: 'KBN-23', title: 'Implementar autenticación JWT', priority: 'alta', assignee: 'JG', col: 0 },
  { id: 'KBN-24', title: 'Diseño UI Dashboard coordinador', priority: 'media', assignee: 'MC', col: 0 },
  { id: 'KBN-11', title: 'API endpoints proyectos', priority: 'alta', assignee: 'LC', col: 1 },
  { id: 'KBN-15', title: 'Módulo de fichas SENA', priority: 'media', assignee: 'SR', col: 1 },
  { id: 'KBN-08', title: 'Testing integración DB', priority: 'baja', assignee: 'PV', col: 2 },
];

const FEATURES = [
  {
    num: '01',
    icon: '🎯',
    iconBg: 'rgba(62,207,142,0.1)',
    title: 'Alinea formación con metas',
    desc: 'Vincula cada proyecto formativo a los resultados de aprendizaje (RAP) del SENA para que aprendices e instructores vean cómo su trabajo construye competencias reales.',
    link: 'Explorar fichas',
  },
  {
    num: '02',
    icon: '📋',
    iconBg: 'rgba(124,106,255,0.1)',
    title: 'Planifica tu celda',
    desc: 'Organiza el trabajo en sprints, asigna tickets a aprendices y sigue el progreso del equipo desde el backlog hasta el tablero Kanban en tiempo real.',
    link: 'Ver tablero',
  },
  {
    num: '03',
    icon: '⚡',
    iconBg: 'rgba(245,200,66,0.1)',
    title: 'Automatiza lo repetitivo',
    desc: 'El sistema mueve automáticamente tickets a revisión, notifica al líder técnico cuando hay bloqueos y actualiza el estado de las tareas según las acciones del equipo.',
    link: 'Ver automatizaciones',
  },
  {
    num: '04',
    icon: '🏆',
    iconBg: 'rgba(255,107,107,0.1)',
    title: 'Gestión por roles reales',
    desc: 'Cada actor — Coordinador, Instructor, Líder Técnico y Aprendiz — tiene su propia interfaz con las herramientas y permisos exactos que su rol requiere.',
    link: 'Ver roles',
  },
  {
    num: '05',
    icon: '📊',
    iconBg: 'rgba(62,207,142,0.1)',
    title: 'Mantente sincronizado',
    desc: 'Dashboards por rol con métricas en tiempo real: velocidad del sprint, tickets por estado, aprendices activos y progreso general por ficha de formación.',
    link: 'Ver métricas',
  },
  {
    num: '06',
    icon: '🔗',
    iconBg: 'rgba(124,106,255,0.1)',
    title: 'Aprende mientras produces',
    desc: 'Cada proyecto genera historial de auditoría y métricas de rendimiento que el instructor usa para evaluar RAPs y el coordinador para tomar decisiones de mejora continua.',
    link: 'Ver bitácora',
  },
];

const ROLES_DATA = {
  coordinador: {
    label: 'Coordinador',
    title: 'Vista completa del sistema formativo',
    desc: 'El coordinador gestiona el ecosistema desde arriba: fichas, instructores, proyectos y resultados de todas las celdas de desarrollo en una sola vista.',
    features: [
      { icon: '📚', title: 'Gestión de Fichas SENA', desc: 'Administra grupos, programa y fechas de cada ficha de formación.' },
      { icon: '👥', title: 'Asignación de instructores', desc: 'Vincula instructores a fichas y proyectos formativos con un clic.' },
      { icon: '📈', title: 'Métricas globales', desc: 'Visualiza el avance de todos los proyectos y detecta cuellos de botella.' },
      { icon: '📋', title: 'Bitácora de auditoría', desc: 'Historial completo de actividades para reportes institucionales.' },
    ],
    statNums: ['12', '48', '96%'],
    statLabels: ['Fichas activas', 'Proyectos', 'Tasa completitud'],
    dotColor: '#3ecf8e',
    navItems: ['Resumen', 'Fichas', 'Usuarios', 'Líderes', 'Ajustes'],
    listItems: ['Ficha ADSO 2670687 · 3 proyectos', 'Ficha ADSO 2813049 · 2 proyectos', 'Ficha SENA 2634789 · 4 proyectos'],
  },
  instructor: {
    label: 'Instructor',
    title: 'Gestión pedagógica en tiempo real',
    desc: 'El instructor supervisa sus proyectos asignados, evalúa competencias y guía a los líderes técnicos en la planificación de cada sprint.',
    features: [
      { icon: '🎓', title: 'Mis fichas asignadas', desc: 'Ve solo los grupos y proyectos de tu responsabilidad pedagógica.' },
      { icon: '✅', title: 'Evaluación de RAPs', desc: 'Marca resultados de aprendizaje conforme el equipo completa entregables.' },
      { icon: '🔍', title: 'Supervisión de equipos', desc: 'Monitorea el rendimiento de cada aprendiz y líder técnico.' },
      { icon: '📝', title: 'Creación de proyectos', desc: 'Crea proyectos formativos vinculados a tu ficha y asigna líderes.' },
    ],
    statNums: ['4', '16', '87%'],
    statLabels: ['Proyectos propios', 'Aprendices', 'RAPs evaluados'],
    dotColor: '#7c6aff',
    navItems: ['Resumen', 'Mis Fichas', 'Aprendices', 'Ajustes'],
    listItems: ['Proyecto: Sistema Inventarios SENA', 'Proyecto: App Mobile ADSO', 'Proyecto: Dashboard Analytics'],
  },
  lider_tecnico: {
    label: 'Líder Técnico',
    title: 'Dirección táctica del equipo de desarrollo',
    desc: 'El líder técnico planifica los sprints, crea y asigna tickets a los aprendices, y mantiene el flujo del tablero Kanban del proyecto.',
    features: [
      { icon: '🗓️', title: 'Gestión de sprints', desc: 'Crea, inicia y cierra sprints organizando el trabajo del equipo.' },
      { icon: '🎫', title: 'Creación de tickets', desc: 'Crea tareas técnicas y las asigna a aprendices con prioridad y fecha límite.' },
      { icon: '🏗️', title: 'Tablero Kanban', desc: 'Vista del estado actual: To Do, In Progress, Testing y Done del equipo.' },
      { icon: '🚩', title: 'Gestión de bloqueos', desc: 'Marca tickets bloqueados y notifica al instructor automáticamente.' },
    ],
    statNums: ['1', '8', '23'],
    statLabels: ['Mi proyecto', 'Aprendices', 'Tickets activos'],
    dotColor: '#f5c842',
    navItems: ['Resumen', 'Mi Proyecto', 'Mi Equipo', 'Ajustes'],
    listItems: ['Sprint 3 · 8 tickets activos', 'KBN-23: Auth JWT en progreso', 'KBN-15: UI Dashboard en testing'],
  },
  aprendiz: {
    label: 'Aprendiz',
    title: 'Tu espacio de trabajo personal',
    desc: 'El aprendiz tiene su tablero personal con sus tickets asignados, puede actualizar el estado de sus tareas y llevar el registro de su progreso formativo.',
    features: [
      { icon: '📌', title: 'Mis tickets asignados', desc: 'Ve solo las tareas que te corresponden, con prioridad y fecha límite.' },
      { icon: '🔄', title: 'Actualizar estados', desc: 'Mueve tus tickets entre columnas a medida que avanzas en el trabajo.' },
      { icon: '💬', title: 'Comentarios y evidencias', desc: 'Añade comentarios y sube evidencias de tus entregables directamente.' },
      { icon: '🔔', title: 'Notificaciones', desc: 'Recibe alertas cuando te asignan nuevas tareas o hay cambios en el sprint.' },
    ],
    statNums: ['5', '2', '78%'],
    statLabels: ['Tickets activos', 'En testing', 'Progreso sprint'],
    dotColor: '#ff6b6b',
    navItems: ['Mi Tablero', 'Mis Tickets', 'Notificaciones', 'Ajustes'],
    listItems: ['KBN-23: Implementar login JWT', 'KBN-31: Pruebas unitarias auth', 'KBN-28: Documentar endpoints'],
  },
};

const TESTIMONIALS = [
  {
    quote: 'Kanbana hizo que el seguimiento de proyectos formativos sea completamente transparente. Puedo ver el avance de todos mis aprendices en tiempo real sin pedir reportes.',
    name: 'Carlos Mendoza',
    role: 'Instructor ADSO, Centro de Teleinformática',
    initial: 'CM',
  },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useIntersection(ref: React.RefObject<Element>, threshold = 0.1) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useIntersection(ref);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const LandingPage = () => {
  const [activeRole, setActiveRole] = useState<keyof typeof ROLES_DATA>('coordinador');
  const [activeStep, setActiveStep] = useState(0);
  const [email, setEmail] = useState('');
  
  // ✅ CAMBIO: Extraemos datos del store para la interfaz dinámica
  const { isAuthenticated, user, clearUser } = useAuthStore();
  const navigate = useNavigate();

  // ✅ CAMBIO: Escuchador del storage para detectar el login desde la ventana hija
  useEffect(() => {
    const handleSync = (e: StorageEvent) => {
      // Si cambia el 'auth-storage' en el navegador, refrescamos esta página
      if (e.key === 'auth-storage') {
        window.location.reload(); 
      }
    };
    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  // ✅ CAMBIO: Función para abrir el login en pestaña/ventana aparte
  const handleOpenLogin = () => {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      '/login', 
      'KanbanaLogin', 
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  };

  const role = ROLES_DATA[activeRole];

  const steps = [
    {
      title: 'Comienza a planificar',
      desc: 'Crea fichas de formación, vincula proyectos y organiza el trabajo en sprints. Kanbana desglosa grandes objetivos pedagógicos en tareas concretas y ejecutables.',
      cta: 'Ver todas las funciones',
    },
    {
      title: 'Céntrate en el impacto',
      desc: 'Gestiona el backlog, asigna tickets y sigue el progreso en tiempo real. El tablero Kanban adapta la vista según el rol — cada actor ve exactamente lo que necesita.',
      cta: 'Conocer el tablero',
    },
    {
      title: 'Mantente sincronizado',
      desc: 'Conecta el trabajo de cada aprendiz con los RAPs del SENA. Instructores y coordinadores tienen métricas en vivo para tomar decisiones pedagógicas informadas.',
      cta: 'Ver métricas',
    },
  ];

  // (Continuaremos con el return en la siguiente parte que me pases...)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── NAV ── */}
      <nav className="nav">
        <a href="#" className="nav-logo">
          <div className="nav-logo-icon">K</div>
          Kanbana
        </a>
        <ul className="nav-links">
          <li><a href="#funciones">Funciones</a></li>
          <li><a href="#roles">Roles</a></li>
          <li><a href="#precios">Precios</a></li>
          <li><a href="#recursos">Recursos</a></li>
        </ul>
        <div className="nav-cta">
          {isAuthenticated ? (
            <>
              <button className="btn-outline" onClick={clearUser} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogOut size={16} />
                Cerrar sesión
              </button>
              <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutDashboard size={16} />
                Dashboard
              </button>
            </>
          ) : (
            <>
              <button className="btn-outline" onClick={handleOpenLogin}>
                Iniciar sesión
              </button>
              <button className="btn-primary" onClick={handleOpenLogin}>
                Comenzar gratis
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-glow" />

        <FadeUp>
          <div className="hero-badge">
            <div className="hero-badge-dot" />
            Plataforma oficial de gestión SENA · ADSO
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <h1 className="hero-title">
            Céntrate en el<br />
            {isAuthenticated ? <em>progreso</em> : <em>aprendizaje</em>},<br />
            no en la administración
          </h1>
        </FadeUp>

        <FadeUp delay={0.2}>
          <p className="hero-sub">
            {isAuthenticated 
              ? `Bienvenido de nuevo. Tu entorno de ${user?.rol} está listo para continuar con los objetivos de la ficha.`
              : 'Gestión de celdas de desarrollo con jerarquía de roles real. Coordinadores, instructores, líderes técnicos y aprendices — cada uno con su espacio, sus datos y sus herramientas.'
            }
          </p>
        </FadeUp>

        {/* ✅ CAMBIO: Hero dinámico según sesión */}
        {isAuthenticated ? (
          <FadeUp delay={0.3}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 16, 
              marginTop: 32,
              padding: '24px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '24px',
              border: '1px solid var(--card-border)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>¡Hola, {user?.nombre}! 👋</div>
              <button className="btn-hero" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                Ir a mi espacio de trabajo <ArrowRight size={20} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sesión activa como {user?.rol}</span>
            </div>
          </FadeUp>
        ) : (
          <FadeUp delay={0.3}>
            <div className="hero-form">
              <input
                className="hero-input"
                type="email"
                placeholder="correo@sena.edu.co"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button className="btn-hero" onClick={handleOpenLogin}>
                Inscribirse
              </button>
            </div>
            <p className="hero-note">Sin tarjeta de crédito · Acceso institucional SENA</p>
          </FadeUp>
        )}

        <FadeUp delay={0.4} style={{ width: '100%', maxWidth: 900 }}>
          <div className="hero-roles">
            {[
              { tag: 'Coordinación', title: 'Fichas\ny proyectos', sub: 'Vista global del sistema' },
              { tag: 'Instrucción', title: 'RAPs y\nevaluación', sub: 'Gestión pedagógica' },
              { tag: 'Liderazgo Técnico', title: 'Sprints y\nKanban', sub: 'Dirección del equipo' },
              { tag: 'Aprendizaje', title: 'Mis tareas\ny progreso', sub: 'Tablero personal' },
            ].map((r, i) => (
              <div key={i} className="hero-role-card">
                <div className="hero-role-tag">{r.tag}</div>
                <div className="hero-role-title" style={{ whiteSpace: 'pre-line' }}>{r.title}</div>
              </div>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ── TRUST ── */}
      <div className="trust">
        <div className="trust-label">Tecnología utilizada en el proyecto</div>
        <div className="trust-logos">
          {['React 18', 'NestJS', 'MySQL', 'TypeScript', 'TanStack Query', 'Framer Motion', 'Tailwind CSS'].map(t => (
            <div key={t} className="trust-logo-item">{t}</div>
          ))}
        </div>
      </div>

      {/* ── SUPERTEAM ── */}
      <section className="superteam" id="funciones">
        <div className="superteam-inner">
          <FadeUp>
            <div>
              <div className="section-label">El equipo de trabajo</div>
              <h2 className="section-title">
                Donde el equipo<br />y el aprendizaje<br />se unen
              </h2>
              <p className="section-sub" style={{ marginTop: 20 }}>
                Kanbana conecta a coordinadores, instructores, líderes técnicos y aprendices en un flujo de trabajo jerárquico y coherente, basado en la metodología SENA.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => isAuthenticated ? navigate('/dashboard') : handleOpenLogin()}>
                  {isAuthenticated ? 'Abrir tablero' : 'Ver en acción'}
                </button>
                <button className="btn-outline">
                  Leer documentación
                </button>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="superteam-visual">
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b6b' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5c842' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8, fontFamily: 'monospace' }}>
                    Proyecto: Sistema Inventarios SENA · Sprint 3
                  </span>
                </div>
                <div className="kanban-preview">
                  {['Por Hacer', 'En Progreso', 'Testing'].map((col, ci) => (
                    <div key={col}>
                      <div className="kanban-col-head">
                        {col}
                        <span className="kanban-count">
                          {KANBAN_TICKETS.filter(t => t.col === ci).length}
                        </span>
                      </div>
                      {KANBAN_TICKETS.filter(t => t.col === ci).map(t => (
                        <div key={t.id} className="kanban-ticket">
                          <div className="kanban-ticket-id">{t.id}</div>
                          <div className="kanban-ticket-title">{t.title}</div>
                          <div className="kanban-ticket-footer">
                            <span className={`ticket-priority p-${t.priority}`}>{t.priority}</span>
                            <div className="ticket-avatar">{t.assignee}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <div className="section" style={{ paddingTop: 120, paddingBottom: 120 }}>
        <FadeUp>
          <div className="section-label">Gestión con tecnología de roles</div>
          <h2 className="section-title">
            Descubre la gestión<br />de proyectos formativos
          </h2>
          <p className="section-sub" style={{ marginTop: 16 }}>
            Deja que el sistema se encargue del seguimiento para que tu equipo pueda centrarse en lo que más importa: aprender y construir.
          </p>
        </FadeUp>

        <div className="features-grid" style={{ marginTop: 60 }}>
          {FEATURES.map((f, i) => (
            <FadeUp key={i} delay={i * 0.08}>
              <div className="feature-card" style={{ height: '100%' }}>
                <div className="feature-num">{f.num}</div>
                <div className="feature-icon" style={{ background: f.iconBg }}>{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <p className="feature-desc">{f.desc}</p>
                <a href="#" className="feature-link">
                  {f.link} <span>→</span>
                </a>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>

      {/* ── INTEGRATIONS / STEPS ── */}
      <section className="integrations-section">
        <div className="integrations-inner">
          <FadeUp>
            <div>
              <div className="section-label">Flujo de trabajo completo</div>
              <h2 className="section-title">
                Haz que el trabajo<br />cobre vida
              </h2>
              <p className="section-sub" style={{ marginTop: 16 }}>
                Kanbana se integra con la metodología de proyectos del SENA. Organízalo todo desde un espacio de trabajo con contexto y control total.
              </p>

              <div className="integration-steps">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className={`step-item ${activeStep === i ? 'active' : ''}`}
                    onClick={() => setActiveStep(i)}
                  >
                    <div className="step-num">{i + 1}</div>
                    <div className="step-content">
                      <div className="step-title">{s.title}</div>
                      {activeStep === i && (
                        <>
                          <p className="step-desc">{s.desc}</p>
                          <a href="#" className="step-cta">{s.cta} →</a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="integration-visual">
              <div className="visual-header">Asistente Kanbana · IA en entrenamiento</div>

              {activeStep === 0 && (
                <>
                  <div className="visual-chat-msg">
                    <div className="chat-avatar chat-avatar-user">SR</div>
                    <div className="chat-bubble">
                      Necesito crear un proyecto para la ficha 2670687 con 3 sprints de 2 semanas
                    </div>
                  </div>
                  <div className="visual-chat-msg">
                    <div className="chat-avatar chat-avatar-ai">K</div>
                    <div className="chat-bubble">
                      <strong>Proyecto creado ✓</strong><br />
                      Sprint 1 (Análisis), Sprint 2 (Desarrollo), Sprint 3 (Testing). ¿Asigno al líder técnico disponible?
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 16px', marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>✓ Proyecto generado automáticamente</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ficha 2670687 · 3 Sprints · 0 tickets</div>
                  </div>
                </>
              )}
              {activeStep === 1 && (
                <>
                  <div style={{ display: 'grid', grid: '1fr 1fr / 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { col: 'Por Hacer', tickets: 5, color: '#7a7a9a' },
                      { col: 'En Progreso', tickets: 3, color: '#7c6aff' },
                      { col: 'Testing', tickets: 2, color: '#f5c842' },
                      { col: 'Completado', tickets: 8, color: '#3ecf8e' },
                    ].map(c => (
                      <div key={c.col} style={{ background: 'var(--bg-2)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{c.col}</div>
                        <div style={{ fontSize: 24, fontFamily: 'var(--ff-display)', fontWeight: 800, color: c.color }}>{c.tickets}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(62,207,142,0.05)', border: '1px solid rgba(62,207,142,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--accent)' }}>
                    🎯 Sprint 3 · 18 tickets · 44% completado · 6 días restantes
                  </div>
                </>
              )}
              {activeStep === 2 && (
                <>
                  <div className="visual-chat-msg">
                    <div className="chat-avatar chat-avatar-ai">K</div>
                    <div className="chat-bubble">
                      <strong>RAPs evaluados esta semana</strong><br />
                      Módulo 3: Implementación de soluciones — 87% de aprendices completaron los criterios de evaluación
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {[
                      { name: 'Juan García', progress: 92, status: 'Completado' },
                      { name: 'María Castro', progress: 78, status: 'En progreso' },
                      { name: 'Luis Peña', progress: 65, status: 'Pendiente' },
                    ].map(a => (
                      <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, background: 'var(--bg-2)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #7c6aff, #3ecf8e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {a.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{a.name}</div>
                          <div style={{ height: 3, background: 'var(--card-border)', borderRadius: 999, marginTop: 4 }}>
                            <div style={{ height: '100%', background: a.progress > 80 ? '#3ecf8e' : a.progress > 70 ? '#f5c842' : '#ff6b6b', borderRadius: 999, width: `${a.progress}%` }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.progress}%</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section id="roles">
        <div className="roles-section">
          <FadeUp>
            <div className="section-label">Para cada actor del proceso formativo</div>
            <h2 className="section-title">
              Para equipos<br />grandes y pequeños
            </h2>
            <p className="section-sub" style={{ marginTop: 16 }}>
              Escucha cómo cada rol tiene exactamente lo que necesita, sin ruido ni información de más.
            </p>
          </FadeUp>

          <div className="roles-tabs" style={{ marginTop: 40 }}>
            {(Object.keys(ROLES_DATA) as Array<keyof typeof ROLES_DATA>).map(r => (
              <button
                key={r}
                className={`role-tab ${activeRole === r ? 'active' : ''}`}
                onClick={() => setActiveRole(r)}
              >
                {ROLES_DATA[r].label}
              </button>
            ))}
          </div>

          <div className="roles-content">
            <FadeUp>
              <div>
                <h3 style={{ fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 16, lineHeight: 1.2 }}>
                  {role.title}
                </h3>
                <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 32 }}>
                  {role.desc}
                </p>
                <div className="role-feature-list">
                  {role.features.map((f, i) => (
                    <div key={i} className="role-feature-item">
                      <div className="role-feature-icon">{f.icon}</div>
                      <div className="role-feature-text">
                        <h4>{f.title}</h4>
                        <p>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-primary" style={{ marginTop: 32 }} onClick={() => isAuthenticated ? navigate('/dashboard') : handleOpenLogin()}>
                  {isAuthenticated ? 'Ver mi tablero' : `Comenzar como ${role.label}`}
                </button>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="role-dashboard-preview">
                <div className="preview-topbar">
                  <div className="preview-dot" style={{ background: '#ff6b6b' }} />
                  <div className="preview-dot" style={{ background: '#f5c842' }} />
                  <div className="preview-dot" style={{ background: '#3ecf8e' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>
                    Kanbana · {role.label}
                  </span>
                </div>
                <div className="preview-body">
                  <div className="preview-sidebar">
                    {role.navItems.map((n, i) => (
                      <div key={n} className={`preview-nav-item ${i === 1 ? 'active' : ''}`}>{n}</div>
                    ))}
                  </div>
                  <div className="preview-main">
                    <div className="preview-stat-row">
                      {role.statNums.map((n, i) => (
                        <div key={i} className="preview-stat">
                          <div className="preview-stat-num" style={{ color: role.dotColor }}>{n}</div>
                          <div className="preview-stat-label">{role.statLabels[i]}</div>
                        </div>
                      ))}
                    </div>
                    {role.listItems.map((item, i) => (
                      <div key={i} className="preview-list-item">
                        <div className="preview-list-dot" style={{ background: role.dotColor }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="testimonial-section">
        <div className="testimonial-inner">
          <FadeUp>
            <div className="testimonial-visual">
              <div className="testimonial-card">
                <p className="testimonial-quote">
                  "{TESTIMONIALS[0].quote}"
                </p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{TESTIMONIALS[0].initial}</div>
                  <div>
                    <div className="testimonial-author-name">{TESTIMONIALS[0].name}</div>
                    <div className="testimonial-author-role">{TESTIMONIALS[0].role}</div>
                  </div>
                </div>
              </div>
              <div className="testimonial-floating">
                🏆 Proyecto destacado SENA Digital 2025
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div>
              <div className="section-label">Impacto real</div>
              <h2 className="section-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
                Resultados que<br />hablan por sí solos
              </h2>
              <div className="testimonial-stats" style={{ marginTop: 40 }}>
                {[
                  { num: '4', suffix: ' roles', label: 'Completamente integrados con jerarquía real y permisos diferenciados' },
                  { num: '100', suffix: '%', label: 'De las secciones funcionales para coordinador, instructor, líder y aprendiz' },
                  { num: '3', suffix: ' niveles', label: 'De navegación jerárquica: fichas → proyectos → equipos y tickets' },
                  { num: '∞', suffix: '', label: 'Proyectos y fichas que puedes crear y gestionar por institución SENA' },
                ].map((s, i) => (
                  <div key={i} className="tstat-card">
                    <div className="tstat-num" style={{ color: i % 2 === 0 ? 'var(--accent)' : 'var(--accent-2)' }}>
                      {s.num}<span style={{ fontSize: '0.5em' }}>{s.suffix}</span>
                    </div>
                    <div className="tstat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── AWARD BANNER ── */}
      <div className="award-banner">
        <div className="award-inner">
          <FadeUp>
            <div className="award-badge">
              <div className="award-badge-title">Proyecto ADSO</div>
              <div className="award-badge-year">2025</div>
              <div className="award-badge-title">SENA</div>
            </div>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="award-text">
              <h3>Kanbana obtuvo el reconocimiento como solución de gestión formativa ADSO</h3>
              <p>
                La única plataforma construida específicamente para celdas de desarrollo del SENA, con soporte real para fichas de formación, resultados de aprendizaje y gestión técnica de proyectos en metodología ágil.
              </p>
            </div>
          </FadeUp>
        </div>
      </div>

      {/* ── COLLECTION ── */}
      <section className="collection-section">
        <div className="collection-inner">
          <FadeUp>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 999, padding: '6px 16px', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
                🗂️ Todas tus herramientas pedagógicas
              </div>
              <h2 className="section-title">
                Todo en un solo<br />espacio de trabajo
              </h2>
              <p className="section-sub" style={{ marginTop: 16 }}>
                Reúne fichas, proyectos, tableros Kanban, evaluación de RAPs y comunicación del equipo en una sola plataforma con contexto y control total.
              </p>
              <button className="btn-primary" style={{ marginTop: 32 }} onClick={() => isAuthenticated ? navigate('/dashboard') : handleOpenLogin()}>
                {isAuthenticated ? 'Abrir Kanbana' : 'Explorar Kanbana'}
              </button>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="collection-icons">
              {[
                { icon: '📋', label: 'Fichas SENA' },
                { icon: '🏗️', label: 'Proyectos' },
                { icon: '📌', label: 'Kanban' },
                { icon: '🎯', label: 'Tickets' },
                { icon: '📊', label: 'Métricas' },
                { icon: '🔔', label: 'Notificaciones' },
              ].map(({ icon, label }) => (
                <div key={label} className="collection-icon-item">
                  <span style={{ fontSize: 32 }}>{icon}</span>
                  <div className="collection-icon-label">{label}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="final-cta">
        <FadeUp>
          <h2 className="final-cta-title">
            No importa lo que tu equipo<br />esté construyendo,<br />
            <em style={{ fontStyle: 'normal', background: 'linear-gradient(135deg, #3ecf8e, #7c6aff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Kanbana te ayuda<br />a hacerlo realidad
            </em>
          </h2>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="final-cta-sub">
            Acceso gratuito para instituciones SENA · Sin límite de proyectos · Soporte incluido
          </p>
        </FadeUp>
        <FadeUp delay={0.2}>
          <div className="final-cta-buttons">
            <button className="btn-final-primary" onClick={() => isAuthenticated ? navigate('/dashboard') : handleOpenLogin()}>
              {isAuthenticated ? 'Ir a mi Dashboard' : 'Conseguir Kanbana gratis'}
            </button>
            <button className="btn-final-outline">
              Ver documentación
            </button>
          </div>
        </FadeUp>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="nav-logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="nav-logo-icon">K</div>
                <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.5px' }}>Kanbana</span>
              </div>
              <p className="footer-brand-desc">
                Plataforma de gestión de celdas de desarrollo para el SENA — ADSO. Construida con React, NestJS y MySQL.
              </p>
            </div>

            {[
              {
                title: 'Producto',
                links: ['Funciones', 'Roles', 'Tablero Kanban', 'Gestión de Fichas', 'Métricas'],
              },
              {
                title: 'Recursos',
                links: ['Documentación', 'API Reference', 'Comunidad', 'Base de conocimiento', 'Crear ticket'],
              },
              {
                title: 'Institución',
                links: ['SENA Colombia', 'ADSO', 'Centro de Teleinformática', 'Normativa', 'Contacto'],
              },
              {
                title: 'Proyecto',
                links: ['Repositorio GitHub', 'Changelog', 'Informe técnico', 'Equipo ADSO', 'Licencia'],
              },
            ].map(col => (
              <div key={col.title}>
                <div className="footer-col-title">{col.title}</div>
                <ul className="footer-links">
                  {col.links.map(l => (
                    <li key={l}><a href="#">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="footer-bottom">
            <div className="footer-copy">
              Copyright © 2025–2026 Kanbana · SENA — ADSO · Proyecto Formativo
            </div>
            <div className="footer-legal">
              <a href="#">Política de privacidad</a>
              <a href="#">Términos</a>
              <a href="#">Aviso legal</a>
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>🇨🇴 Español</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;