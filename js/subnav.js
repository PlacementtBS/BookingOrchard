export function subnav(links) {
  const currentPath = location.hash.slice(1).split('?')[0] || '/';
  return `
    <div class="subnav">
      ${links.map(({ link, label }) => {
        const linkPath = link.startsWith('#') ? link.slice(1).split('?')[0] : link.split('?')[0];
        const activeClass = linkPath === currentPath ? 'activesubnav' : '';
        return `<a href="${link}" class="${activeClass}">${label}</a>`;
      }).join('')}
    </div>
  `;
}
