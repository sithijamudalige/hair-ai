import React, { useState } from 'react';

export default function Signup({ onSignup }) {
  const [form, setForm] = useState({
    name: '', gender: '', email: '', password: '',
    confirmPassword: '', mobile: '', date_of_birth: '', profile_photo: null
  });
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value, files } = e.target;
    setForm(f => ({ ...f, [name]: files ? files[0] : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    const body = new FormData();
    for (const key in form) body.append(key, form[key]);
    const res = await fetch('http://localhost:8000/api/signup', {
      method: 'POST',
      body
    });
    if (!res.ok) return setError('Signup failed, user may exist');
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    onSignup();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" onChange={handleChange} placeholder="Name" required />
      <select name="gender" onChange={handleChange} required>
        <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
      </select>
      <input name="email" type="email" onChange={handleChange} placeholder="Email" required />
      <input name="password" type="password" onChange={handleChange} placeholder="Password" required />
      <input name="confirmPassword" type="password" onChange={handleChange} placeholder="Confirm Password" required />
      <input name="mobile" onChange={handleChange} placeholder="Mobile" required />
      <input name="date_of_birth" type="date" onChange={handleChange} required />
      <input name="profile_photo" type="file" accept="image/*" onChange={handleChange} />
      <button type="submit">Sign Up</button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}