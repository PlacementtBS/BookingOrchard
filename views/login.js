// src/views/login.js

import { login } from "../js/auth.js";

export default function renderLogin() {
  return `
    <form id="login-form" novalidate>
      <h1>Login</h1>
      <label for="email">Email</label>
      <input type="email" id="email" name="email" autocomplete="email" required placeholder="you@example.com" />
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required placeholder="••••••••" />
      <input type="submit" class="primaryButton" value="Login" />
    </form>
    <p id="message" aria-live="polite" style="color: red; margin-top: 10px;"></p>
  `;
}

export function setupLoginForm() {
  const form = document.getElementById('login-form');
  const message = document.getElementById('message');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    try {
      const success = await login(email, password);

      if (success) {
        message.textContent = 'Login successful!';
        message.style.color = 'green';
      } else {
        message.textContent = 'Invalid email or password.';
        message.style.color = 'red';
      }
    } catch (error) {
      message.textContent = 'An error occurred. Please try again.';
      message.style.color = 'red';
      console.error(error);
    }
  });
}
