import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons.jsx';

const slides = [
  {
    title: 'Light Up Your Diwali',
    text: 'Premium quality crackers direct from Sivakasi at the best prices.',
    cta: 'Shop Now',
    offer: 'UP TO 90% OFF MRP',
    art: ['sparkles', 'rocket', 'star'],
    tone: 'primary',
  },
  {
    title: 'Family Gift Boxes',
    text: 'Curated combos with something for kids, teens and grown-ups.',
    cta: 'View Gift Boxes',
    offer: 'Festival Combo Offers',
    art: ['gift', 'flame', 'party-popper'],
    tone: 'accent',
  },
  {
    title: 'Sky Shots & Rockets',
    text: 'Fill the night sky with dazzling colours and spectacular finales.',
    cta: 'Explore Sky Shots',
    offer: 'New Season Arrivals',
    art: ['rocket', 'moon', 'zap'],
    tone: 'secondary',
  },
  {
    title: 'Safe & Kid Friendly',
    text: 'Low-noise, eco-friendly green crackers for the little ones.',
    cta: 'Kids Special',
    offer: 'Safe for Kids',
    art: ['baby', 'pencil', 'rainbow'],
    tone: 'primary',
  },
];

export default function BannerSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [paused]);

  const go = (step) => setIndex((i) => (i + step + slides.length) % slides.length);

  return (
    <section
      className="slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="slides" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <div className={`slide tone-${s.tone}`} key={s.title} aria-hidden={i !== index}>
            <div className="fireworks" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className="firework" />)}
            </div>
            <div className="slide-text">
              <span className="glass-badge">
                <Icon name="sparkles" size={14} /> {s.offer}
              </span>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <Link to="/products" className="btn btn-light" tabIndex={i === index ? 0 : -1}>
                {s.cta} <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <div className="slide-art" aria-hidden="true">
              {s.art.map((name) => (
                <Icon key={name} name={name} size={72} strokeWidth={1.5} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="slider-arrow left" aria-label="Previous slide" onClick={() => go(-1)}>
        <Icon name="chevron-left" size={24} />
      </button>
      <button className="slider-arrow right" aria-label="Next slide" onClick={() => go(1)}>
        <Icon name="chevron-right" size={24} />
      </button>

      <div className="dots">
        {slides.map((s, i) => (
          <button
            key={s.title}
            className={`dot ${i === index ? 'active' : ''}`}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
