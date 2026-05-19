import { useEffect, useState } from 'react';
import type { Slide } from '../landing.types';

type RoleCarouselProps = {
  slides: Slide[];
};

export const RoleCarousel = ({ slides }: RoleCarouselProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  return (
    <div className="carousel">
      <div className="car-top">
        <span className="dot" style={{ background: '#f04d4d' }} />
        <span className="dot" style={{ background: '#e0a32e' }} />
        <span className="dot" style={{ background: '#39c46f' }} />
        <span className="car-title">Kanbana — Panel del {slides[currentSlide].role}</span>
      </div>

      <div className="carousel-viewport">
        <div
          className="carousel-track"
          style={{
            transform: `translateX(-${currentSlide * 100}%)`,
          }}
        >
          {slides.map((slide) => (
            <div key={slide.role} className="slide">
              <div className="md-side">
                <div className="md-brand">
                  <div className="md-logo">K</div>
                  <span className="md-bname">Kanbana</span>
                </div>

                <div className="md-nav-label">{slide.sideLabel}</div>

                {slide.sideItems.map((item, idx) => (
                  <div key={item} className={`md-item ${idx === slide.activeItemIndex ? 'on' : ''}`}>
                    <span className="mi-ic" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="md-main">
                <span className={`md-role-tag ${slide.badge}`}>{slide.role}</span>
                <div className="md-h">{slide.title}</div>
                <div className="md-sub">{slide.subtitle}</div>

                <div className="md-stats">
                  {slide.stats.map(([value, label]) => (
                    <div key={label} className="md-stat">
                      <div className="v">{value}</div>
                      <div className="l">{label}</div>
                    </div>
                  ))}
                </div>

                {slide.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="car-ctrl">
        <span className="car-label">
          Vista del rol: <b>{slides[currentSlide].role}</b>
        </span>

        <div className="car-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`car-dot ${currentSlide === index ? 'on' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Ir al slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="car-arrows">
          <button className="car-arrow" onClick={prevSlide} aria-label="Anterior">
            ‹
          </button>
          <button className="car-arrow" onClick={nextSlide} aria-label="Siguiente">
            ›
          </button>
        </div>
      </div>
    </div>
  );
};