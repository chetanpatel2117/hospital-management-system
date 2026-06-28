document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.endsWith('login page.html') || path === '/' || path.endsWith('/login');
  const currentUser = localStorage.getItem('hospitalUser');

  if (!currentUser && !isLoginPage) {
    window.location.href = 'login page.html';
    return;
  }

  if (currentUser && isLoginPage) {
    window.location.href = 'dashboard.html';
    return;
  }

  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      const name = user.name || user.fullName || user.username || 'User';
      const role = user.role || user.designation || 'Administrator';

      document.querySelectorAll('[data-profile-name], #profileName').forEach((element) => {
        element.textContent = name;
      });

      document.querySelectorAll('[data-profile-role], #profileRole').forEach((element) => {
        element.textContent = role;
      });

      const photo = user.photo || '';
      document.querySelectorAll('[data-profile-image], #profileicon, #headerProfileImage').forEach((element) => {
        if (photo) {
          element.src = photo;
        } else if (!element.getAttribute('src')) {
          element.src = 'assets/image/profile.png';
        }
      });
    } catch (error) {
      console.error('Unable to update profile from auth state:', error);
    }
  }

  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      localStorage.removeItem('hospitalUser');
      window.location.href = 'login page.html';
    });
  });
});
 const notificationBtn = document.getElementById('notificationBtn');
  const notificationPanel = document.getElementById('notificationPanel');
  const messageBtn = document.getElementById('messageBtn');
  const messagePanel = document.getElementById('messagePanel');

  function togglePanel(panel) {
    const isHidden = panel.classList.contains('hidden');
    notificationPanel?.classList.add('hidden');
    messagePanel?.classList.add('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
    }
  }

  notificationBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(notificationPanel);
  });

  messageBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(messagePanel);
  });

  document.addEventListener('click', () => {
    notificationPanel?.classList.add('hidden');
    messagePanel?.classList.add('hidden');
  });