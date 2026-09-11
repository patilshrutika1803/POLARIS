import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/ship-navigation', label: 'Ship Navigation' },
  { to: '/iceberg-analysis', label: 'Iceberg Analysis' },
  { to: '/risk-analysis', label: 'Risk Analysis' },
  { to: '/ai-assistant', label: 'AI Assistant' },
];

export default function TopNav() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateOptions = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' };
  const timeOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-icon">🧭</div>
        <div className="brand-text">
          <b>POLARIS</b>
          <span>ANTARCTIC NAVIGATION &amp; DECISION SUPPORT</span>
        </div>
      </div>

      <div className="nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      <div className="clock">
        {now.toLocaleDateString('en-GB', dateOptions).toUpperCase()}
        <br />
        {now.toLocaleTimeString('en-GB', timeOptions)} IST
      </div>

      <style>{`
        .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(80,180,220,.15);}
        .brand{display:flex;align-items:center;gap:10px;}
        .brand-icon{width:30px;height:30px;background:linear-gradient(135deg,var(--cyan),#1a5f80);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 14px var(--cyan-glow);}
        .brand-text b{display:block;font-size:14.5px;letter-spacing:.6px;color:#f2fbff;font-weight:700;}
        .brand-text span{font-size:10px;color:var(--muted);letter-spacing:1.2px;}
        .nav{display:flex;gap:4px;background:rgba(255,255,255,.02);padding:4px;border-radius:9px;border:1px solid rgba(80,180,220,.12);}
        .nav a{background:none;border:none;color:var(--muted);padding:7px 13px;border-radius:6px;font-size:12.5px;font-weight:500;cursor:pointer;text-decoration:none;transition:.15s;}
        .nav a.active{background:linear-gradient(180deg,#1391c4,#0c6a94);color:#fff;box-shadow:0 2px 10px rgba(19,145,196,.5);}
        .nav a:not(.active):hover{color:var(--text);}
        .clock{font-family:var(--font-mono);font-size:11px;color:var(--muted);text-align:right;}
      `}</style>
    </div>
  );
}
