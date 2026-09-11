import { useEffect, useState } from "react";
import "./SplashScreen.css";

const slides = [
  "ANTARCTICA SHIFTS.",
  "POLARIS PREDICTS.",
  "SEE THE ICE. READ THE RISK.",
  "NAVIGATE WHAT'S NEXT.",
];

export default function SplashScreen({ onComplete }) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setSlide((prev) => (prev + 1) % slides.length);
    }, 1100);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4800);

    return () => {
      clearInterval(slideTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="splash-screen">

      {/* Atmospheric layers */}
      <div className="splash-aurora splash-pink" />
      <div className="splash-aurora splash-yellow" />
      <div className="splash-aurora splash-purple" />
      <div className="splash-aurora splash-green" />
      <div className="splash-aurora splash-white" />

      {/* Water / ice texture */}
      <div className="water-lines" />
      <div className="ice-glow" />

      {/* Floating particles */}
      <div className="particles">
        <span>✦</span>
        <span>·</span>
        <span>❄</span>
        <span>·</span>
        <span>✦</span>
        <span>·</span>
        <span>❄</span>
        <span>·</span>
      </div>

      <main className="splash-content">

        {/* Cute Antarctic element */}
        <div className="polar-object">

          <div className="penguin">
            <div className="penguin-head">
              <span className="eye left-eye" />
              <span className="eye right-eye" />
            </div>

            <div className="penguin-body">
              <div className="penguin-belly" />
              <div className="wing left-wing" />
              <div className="wing right-wing" />
            </div>

            <div className="penguin-feet">
              <span />
              <span />
            </div>
          </div>

          <div className="tiny-iceberg">
            <div className="ice-top" />
            <div className="ice-body" />
          </div>

        </div>

        {/* Small label */}
        <div className="system-label">
          <span className="label-line" />
          ANTARCTIC DECISION SUPPORT SYSTEM
          <span className="label-line" />
        </div>

        {/* Main Logo */}
        <h1 className="polaris-logo">
          <span>P</span>
          <span>O</span>
          <span>L</span>
          <span>A</span>
          <span>R</span>
          <span>I</span>
          <span>S</span>
        </h1>

        {/* Tagline slideshow */}
        <div className="tagline-wrapper">
          <div className="tagline" key={slide}>
            {slides[slide]}
          </div>
        </div>

        {/* Slide indicators */}
        <div className="slide-indicators">
          {slides.map((_, index) => (
            <span
              key={index}
              className={index === slide ? "active" : ""}
            />
          ))}
        </div>

        {/* Bottom system status */}
        <div className="splash-status">
          <span className="status-dot" />
          INITIALIZING POLAR NAVIGATION SYSTEM
        </div>

      </main>

      <div className="splash-bottom">
        ANTARCTIC OCEAN · ICE · CURRENT · RISK · ROUTE
      </div>

    </div>
  );
}