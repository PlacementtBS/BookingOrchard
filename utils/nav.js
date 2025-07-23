// nav.js
const navHTML = `
<nav>
  <a href="../">
    <img src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Group%205.png" alt="Company logo" />
  </a>
  <div>
    <a href="../landing">Dashboard</a>
    <a href="../landing">Tasks</a>
    <a href="../landing">Notifications</a>
    <hr />
    <a href="../userManagement">Users</a>
    <a href="../venueManagement">Venues</a>
  </div>
  <button id="btn-logout" class="primaryButton">Log out</button>
</nav>
`;

// Insert the nav at the top of <body>
document.body.insertAdjacentHTML('afterbegin', navHTML);

// Highlight the current page link
const navLinks = document.querySelectorAll('nav a[href]');
const currentPath = window.location.pathname;

navLinks.forEach(link => {
  const linkPath = new URL(link.href).pathname;

  // If current path matches link (or is inside its folder), highlight it
  if (currentPath === linkPath || currentPath.startsWith(linkPath + '/')) {
    link.classList.add('active');
  }
});

// Optional: handle logout button if needed
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    // add your logout logic here
    console.log('Logging out…');
  });
}
