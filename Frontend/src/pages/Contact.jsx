import { useState } from 'react';
import Icon from '../components/Icons.jsx';

const info = [
  { icon: 'map-pin', title: 'Address', lines: ['Aaradhaya Crackers', 'Sivakasi, Tamil Nadu, India'] },
  { icon: 'phone', title: 'Phone', lines: ['+91 99622 42656', '+91 95004 40515'] },
  { icon: 'mail', title: 'Email', lines: ['aaradhyacrackers@gmail.com'] },
  { icon: 'clock', title: 'Working Hours', lines: ['Mon – Sun: 9:00 AM – 9:00 PM'] },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: '', email: '', message: '' });
  };

  return (
    <div className="page">
      <h1 className="page-title">Contact Us</h1>

      <div className="contact-grid">
        {info.map((c) => (
          <div className="feature-card" key={c.title}>
            <span className="feature-icon"><Icon name={c.icon} size={26} /></span>
            <h3>{c.title}</h3>
            {c.lines.map((l) => <p key={l}>{l}</p>)}
          </div>
        ))}
      </div>

      <div className="card contact-form">
        <h2>Send us a message</h2>
        {sent && (
          <p className="success-msg with-icon">
            <Icon name="check" size={18} /> Thanks! We will get back to you shortly.
          </p>
        )}
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" required value={form.name} onChange={onChange} />
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" name="email" required value={form.email} onChange={onChange} />
            </label>
            <label className="field span-2">
              <span>Message</span>
              <textarea className="input" name="message" rows="5" required maxLength={1000} value={form.message} onChange={onChange} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary">
            <Icon name="mail" size={18} /> Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
