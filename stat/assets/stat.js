(() => {
  const AUTH_KEY = 'agentanium-stat-auth';
  const loginPage = document.body.classList.contains('login-page');
  const loggedIn = sessionStorage.getItem(AUTH_KEY) === 'ok';

  if (loginPage) {
    if (loggedIn) location.replace('./');
    const form = document.querySelector('#loginForm');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const login = String(data.get('login') || '').trim().toLowerCase();
      const password = String(data.get('password') || '').trim().toLowerCase();
      const simpleCredentials = ['admin', 'админ'].includes(login) && ['admin', 'админ'].includes(password);
      const legacyCredentials = login === 'admin-admin' && password === 'admin-admin-password';
      const valid = simpleCredentials || legacyCredentials;
      const status = document.querySelector('#loginStatus');
      if (!valid) {
        status.textContent = 'Неверный логин или пароль';
        form.querySelector('input')?.focus();
        return;
      }
      sessionStorage.setItem(AUTH_KEY, 'ok');
      location.replace('./');
    });
    return;
  }

  if (!loggedIn) {
    location.replace('./login.html');
    return;
  }

  document.querySelector('#logout')?.addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.replace('./login.html');
  });
  const menu = document.querySelector('#menuButton');
  const overlay = document.querySelector('.mobile-overlay');
  const toggleMenu = (state) => document.body.classList.toggle('menu-open', state);
  menu?.addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
  overlay?.addEventListener('click', () => toggleMenu(false));

  const points = [42,58,51,72,68,88,80,96,92,110,104,124];
  document.querySelectorAll('[data-sparkline]').forEach((svg, index) => {
    const values = points.map((v,i) => v * (.72 + index * .07) + Math.sin(i + index) * 8);
    const max = Math.max(...values), min = Math.min(...values);
    const path = values.map((v,i) => `${i ? 'L':'M'} ${i * 36} ${100 - ((v-min)/(max-min || 1))*76}`).join(' ');
    svg.innerHTML = `<path d="${path}" fill="none" stroke="${index === 1 ? '#e2912b' : '#2457e6'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 100H396" stroke="#edf0f4"/>`;
  });
})();
