import { hashPassword } from "./hash.js";
import { insert,remove , select } from "./db.js";

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
function generateToken() {
  // generates a random hex token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  await insert('sessions', {
    token,
    user_id: userId,
    expires_at: expiresAt.toISOString()
  });
  localStorage.setItem('sessionToken', token);
}
export default async function createAccount(forename, surname, email, password, organisationId) {
  const pwh = await hashPassword(password);

  const result = await insert("users", {
    forename,
    surname,
    email,
    passwordHash: pwh.hash,
    saltHash: pwh.salt,
    organisationId,
    activated: true
  });

  return result;
}

export async function login(email, password) {
  try {
    const users = await select("users", "*", {
      column: "email",
      operator: "eq",
      value: email
    });

    const user = users[0];
    if (!user) {
      console.warn(`Login failed: no user with email ${email}`);
      alert("Invalid email or password.");
      return false;
    }

    const saltBytes = hexToBytes(user.saltHash);

    const pwh = await hashPassword(password, saltBytes);

    if (pwh.hash === user.passwordHash) {
      console.log("✅ Login successful");
      await createSession(user.id);
      window.location.href = "../landing";
      return true;
    } else {
      console.warn("Login failed: password mismatch");
      alert("Invalid email or password.");
      return false;
    }

  } catch (err) {
    console.error("Error during login:", err);
    alert("An error occurred during login.");
    return false;
  }
}

/**
 * Verifies session token and returns live user data, or redirects to login if invalid.
 * @returns {Promise<object>} user data
 */
export async function checkSession() {
  const token = localStorage.getItem('sessionToken');
  if (!token) return redirect();

  const [session] = await select('sessions', '*', {
    column: 'token',
    operator: 'eq',
    value: token
  }) || [];

  if (!session || new Date(session.expires_at) < Date.now()) {
    localStorage.removeItem('sessionToken');
    return redirect();
  }

  const [user] = await select('users', '*', {
    column: 'id',
    operator: 'eq',
    value: session.user_id
  }) || [];

  if (!user) return redirect();

  return user;

  function redirect() {
    window.location.href = '../login';
    return null;
  }
}
export async function logout() {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    window.location.href = '../login';
    return;
  }

  try {
    // get session from DB
    const [session] = await select('sessions', '*', {
      column: 'token',
      operator: 'eq',
      value: token
    }) || [];

    if (session) {
      // remove from DB
      await remove('sessions', {
        column: 'token',
        operator: 'eq',
        value: token
      });
    }

    // remove from localStorage
    localStorage.removeItem('sessionToken');

    console.log("✅ User logged out.");
  } catch (err) {
    console.error("Error during logout:", err);
  } finally {
    window.location.href = '../login';
  }
}
