(function(){
  if (typeof firebase === 'undefined') return;
  const db = firebase.firestore();
  const auth = firebase.auth();

  const PASSWORD_STORAGE_KEY = 'shared_grid_passwords';
  let hasPasswordAccess = false;
  let hoverTimeout = null;
  let tooltipElement = null;
  
  // Generate random ID (32 characters)
  function generateRandomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  function maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email;
    
    const localPart = email.substring(0, atIndex);
    const domainPart = email.substring(atIndex + 1);
    
    // Mask local part: show first 2 chars, stars in middle, last 2 chars
    let maskedLocal;
    if (localPart.length <= 4) {
      maskedLocal = localPart;
    } else {
      const first2 = localPart.substring(0, 2);
      const last2 = localPart.substring(localPart.length - 2);
      const middleLength = localPart.length - 4;
      const stars = '*'.repeat(middleLength);
      maskedLocal = first2 + stars + last2;
    }
    
    return maskedLocal + '@' + domainPart;
  }
  
  function showEmailTooltip(email, cellElement) {
    // Remove any existing tooltip
    hideEmailTooltip();
    
    if (!email) return;
    
    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'email-tooltip';
    tooltipElement.textContent = maskEmail(email);
    
    // Position tooltip near the cell
    const rect = cellElement.getBoundingClientRect();
    tooltipElement.style.position = 'fixed';
    tooltipElement.style.left = (rect.left + rect.width / 2) + 'px';
    tooltipElement.style.top = (rect.top - 30) + 'px';
    tooltipElement.style.transform = 'translateX(-50%)';
    tooltipElement.style.backgroundColor = '#333';
    tooltipElement.style.color = '#fff';
    tooltipElement.style.padding = '6px 10px';
    tooltipElement.style.borderRadius = '4px';
    tooltipElement.style.fontSize = '12px';
    tooltipElement.style.zIndex = '10000';
    tooltipElement.style.whiteSpace = 'nowrap';
    tooltipElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    
    document.body.appendChild(tooltipElement);
  }
  
  function hideEmailTooltip() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    if (tooltipElement) {
      tooltipElement.remove();
      tooltipElement = null;
    }
  }
  
  function getStoredPassword(boardId) {
    try {
      const stored = localStorage.getItem(PASSWORD_STORAGE_KEY);
      if (!stored) return '';
      const passwords = JSON.parse(stored);
      return passwords[boardId] || '';
    } catch (e) {
      console.error('Error getting stored password:', e);
      return '';
    }
  }
  
  function storePassword(boardId, password) {
    try {
      const stored = localStorage.getItem(PASSWORD_STORAGE_KEY);
      const passwords = stored ? JSON.parse(stored) : {};
      passwords[boardId] = password;
      localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(passwords));
    } catch (e) {
      console.error('Error storing password:', e);
    }
  }
  
  function clearStoredPasswords() {
    try {
      console.log('Clearing all stored passwords from localStorage');
      const before = localStorage.getItem(PASSWORD_STORAGE_KEY);
      console.log('Passwords before clear:', before);
      localStorage.removeItem(PASSWORD_STORAGE_KEY);
      const after = localStorage.getItem(PASSWORD_STORAGE_KEY);
      console.log('Passwords after clear:', after);
    } catch (e) {
      console.error('Error clearing passwords:', e);
    }
  }
  
  const gridRoot = document.getElementById('squares-grid');
  if (!gridRoot) return;
  const toast = document.getElementById('toast');
  function showToast(message, options = {}) {
    if (!toast) return;
    toast.textContent = message;
    if (options.redBorder) {
      toast.style.border = '2px solid #ef4444';
    } else {
      toast.style.border = '';
    }
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.border = '';
    }, 1500);
  }

  const lockedBanner = (function(){
    const section = document.getElementById('grid-section');
    if (!section) return null;
    const div = document.createElement('div');
    div.id = 'locked-banner';
    div.className = 'locked-banner hidden';
    div.textContent = 'Selection is locked';
    section.insertBefore(div, section.firstChild);
    return div;
  })();

  let boardTitleContainer = null;
  let teamAEl = null;
  let vsEl = null;
  let teamBEl = null;
  const boardTitleEl = (function(){
    const section = document.getElementById('grid-section');
    if (!section) return null;
    
    // Create a container for title and share button with centered title
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'flex-start';
    titleContainer.style.marginBottom = '8px';
    
    // Left div with print button
    const leftDiv = document.createElement('div');
    leftDiv.style.flex = '1';
    const printBtn = document.createElement('button');
    printBtn.id = 'print-btn';
    printBtn.textContent = 'Print';
    printBtn.style.whiteSpace = 'nowrap';
    printBtn.style.fontWeight = '600';
    printBtn.style.padding = '10px 14px';
    leftDiv.appendChild(printBtn);
    
    // Middle div with title and team names
    const middleDiv = document.createElement('div');
    middleDiv.style.flex = '1';
    middleDiv.style.textAlign = 'center';
    
    const h = document.createElement('h1');
    h.id = 'board-title';
    h.className = 'board-title';
    h.style.margin = '0';
    h.style.marginBottom = '4px';
    middleDiv.appendChild(h);
    
    // Team A
    const teamA = document.createElement('div');
    teamA.id = 'title-team-a';
    teamA.style.fontSize = '18px';
    teamA.style.fontWeight = '600';
    teamA.style.marginBottom = '2px';
    teamA.textContent = 'Team A';
    middleDiv.appendChild(teamA);
    teamAEl = teamA;
    
    // vs
    const vs = document.createElement('div');
    vs.id = 'title-vs';
    vs.style.fontSize = '14px';
    vs.style.marginBottom = '2px';
    vs.textContent = 'vs';
    middleDiv.appendChild(vs);
    vsEl = vs;
    
    // Team B
    const teamB = document.createElement('div');
    teamB.id = 'title-team-b';
    teamB.style.fontSize = '18px';
    teamB.style.fontWeight = '600';
    teamB.textContent = 'Team B';
    middleDiv.appendChild(teamB);
    teamBEl = teamB;
    
    // Right div with share button
    const rightDiv = document.createElement('div');
    rightDiv.style.flex = '1';
    rightDiv.style.textAlign = 'right';
    const shareBtn = document.createElement('button');
    shareBtn.id = 'share-btn';
    shareBtn.textContent = 'Share';
    shareBtn.style.whiteSpace = 'nowrap';
    shareBtn.style.fontWeight = '600';
    shareBtn.style.padding = '10px 14px';
    rightDiv.appendChild(shareBtn);
    
    titleContainer.appendChild(leftDiv);
    titleContainer.appendChild(middleDiv);
    titleContainer.appendChild(rightDiv);
    
    const insertAfter = lockedBanner && lockedBanner.nextSibling ? lockedBanner.nextSibling : section.firstChild;
    if (insertAfter) {
      section.insertBefore(titleContainer, insertAfter);
    } else {
      section.appendChild(titleContainer);
    }
    
    boardTitleContainer = titleContainer;
    return h;
  })();

  const userCountEl = document.getElementById('user-res-count') || (function(){
    const section = document.getElementById('grid-section');
    if (!section) return null;
    const div = document.createElement('div');
    div.id = 'user-res-count';
    div.className = 'user-count';
    div.textContent = 'Squares: 0';
    const title = section.querySelector('.grid-title');
    if (title && title.parentNode) {
      title.parentNode.insertBefore(div, title.nextSibling);
    } else {
      section.insertBefore(div, section.firstChild);
    }
    return div;
  })();

  const scoreboardEl = (function(){
    const section = document.getElementById('grid-section');
    if (!section) return null;
    const div = document.createElement('div');
    div.id = 'scoreboard';
    div.className = 'scoreboard hidden';
    section.appendChild(div);
    return div;
  })();

  function reorderLayout() {
    const section = document.getElementById('grid-section');
    if (!section) return;
    const teamATitle = section.querySelector('.grid-title');
    const wrapper = section.querySelector('.grid-wrapper');
    const anchors = [boardTitleContainer, userCountEl, scoreboardEl, teamATitle, wrapper].filter(Boolean);
    let beforeNode = null;
    anchors.forEach((el) => {
      if (!el) return;
      if (beforeNode === null) {
        if (lockedBanner && section.firstChild === lockedBanner && lockedBanner.nextSibling) {
          section.insertBefore(el, lockedBanner.nextSibling);
        } else {
          section.insertBefore(el, section.firstChild);
        }
      } else {
        if (el !== beforeNode.nextSibling) {
          section.insertBefore(el, beforeNode.nextSibling);
        }
      }
      beforeNode = el;
    });
  }

  async function getBoardId() {
    const params = new URLSearchParams(location.search || '');
    const boardId = params.get('boardID');
    const code = params.get('code');
    
    // If code is provided, resolve it to a boardID
    if (code) {
      try {
        const codeDoc = await db.collection('shortCodes').doc(code.toLowerCase()).get();
        if (codeDoc.exists) {
          const data = codeDoc.data();
          // Show toast with red border when using short code
          setTimeout(() => showToast(`Loaded board from short code: ${code}`, { redBorder: true }), 500);
          return data.boardId || '';
        } else {
          console.warn('Short code not found:', code);
          return '';
        }
      } catch (err) {
        console.error('Error resolving short code:', err);
        return '';
      }
    }
    
    return boardId || '';
  }
  
  let boardId = '';
  
  // Initialize boardId asynchronously
  (async function initializeBoardId() {
    boardId = await getBoardId();
    if (!boardId) {
      console.error('No board ID found');
      document.body.innerHTML = '<div style="padding:20px;text-align:center;"><h2>No board found</h2><p>Invalid board ID or short code.</p></div>';
      return;
    }
    // Continue with initialization
    init();
  })();

  function loadGridDoc() {
    return db.collection('grids').doc(boardId).get();
  }

  function formatLabelHTML(label) {
    const a = (label || '').slice(0, 4);
    const b = (label || '').slice(4, 8);
    return a + '<br/>' + b;
  }

  function cleanPart(str) { return (str || '').replace(/[^A-Za-z]/g, '').slice(0, 4); }
  function getUserLabel(user) {
    let first = '', last = '';
    
    // If user has a displayName (e.g., from Google), use first/last name format
    if (user && user.displayName) {
      const parts = user.displayName.trim().split(/\s+/);
      first = parts[0] || '';
      last = parts.slice(1).join(' ') || '';
      
      let a = cleanPart(first);
      let b = cleanPart(last);
      if (!a) { const local = (user?.email || '').split('@')[0]; a = cleanPart(local) || 'XXXX'; }
      if (!b) b = 'XXXX';
      a = a.substring(0, 4).padEnd(4, 'X');
      b = b.substring(0, 4).padEnd(4, 'X');
      return a + b;
    }
    
    // For email-only users (no displayName)
    if (user && user.email) {
      const local = user.email.split('@')[0];
      const domain = user.email.split('@')[1] || '';
      
      // Check if email has dot or hyphen in local part
      if (local.includes('.') || local.includes('-')) {
        const tokens = local.split(/[._-]+/);
        first = tokens[0] || '';
        last = tokens[1] || '';
        
        let a = cleanPart(first);
        let b = cleanPart(last);
        if (!a) a = 'XXXX';
        if (!b) b = 'XXXX';
        a = a.substring(0, 4).padEnd(4, 'X');
        b = b.substring(0, 4).padEnd(4, 'X');
        return a + b;
      } else {
        // No dot or hyphen, use email @ domain format
        let a = cleanPart(local);
        if (!a) a = 'XXXX';
        a = a.substring(0, 4).padEnd(4, 'X');
        
        let b = '@' + domain.substring(0, 3);
        if (!domain) b = '@XXX';
        
        return a + b;
      }
    }
    
    return 'XXXXXXXX';
  }

  // Track that user accessed this board
  async function trackBoardAccess(boardId) {
    if (!boardId) return;
    
    const user = auth.currentUser;
    if (!user) {
      // Not logged in - store in localStorage to track after login
      console.log('Not logged in, storing board for later tracking:', boardId);
      try {
        localStorage.setItem('lastBoardAccessed', boardId);
      } catch (e) {
        console.warn('Failed to store board in localStorage:', e);
      }
      return;
    }
    
    try {
      const userRef = db.collection('users').doc(user.uid);
      await userRef.set({
        accessedBoards: firebase.firestore.FieldValue.arrayUnion(boardId)
      }, { merge: true });
      console.log('Tracked board access:', boardId);
      // Refresh dropdown to show the newly accessed board
      enhanceYearSelectLabels();
    } catch (err) {
      console.warn('Failed to track board access:', err);
    }
  }

  let tableEl = null;
  let userReservationCount = 0;
  let isLocked = false;
  let currentReservations = {};
  let lastQ1Coord = null;
  let lastQ2Coord = null;
  let lastQ3Coord = null;
  let lastFinalCoord = null;
  function setUserCount(n) {
    userReservationCount = n;
    if (userCountEl) {
      const user = auth.currentUser;
      const tag = user ? getUserLabel(user) : 'N/A';
      userCountEl.textContent = 'Squares for ' + tag + ': ' + String(n);
    }
  }

  function countReservationsForCurrentUser(reservations) {
    const uid = auth.currentUser?.uid || '';
    if (!uid || !reservations || typeof reservations !== 'object') return 0;
    let total = 0;
    Object.values(reservations).forEach((val) => {
      if (val && val.userId === uid) total++;
    });
    return total;
  }

  function renderGrid() {
    const rows = 11, cols = 11;
    const table = document.createElement('table');
    table.className = 'board-table';
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        const inner = document.createElement('div');
        inner.className = 'cell-inner';
        if (r === 0 || c === 0) {
          inner.textContent = '?';
        } else {
          if (isLocked) {
            inner.textContent = 'X';
          } else {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'reserve-link';
            link.dataset.r = String(r);
            link.dataset.c = String(c);
            link.textContent = 'X';
            inner.appendChild(link);
          }
        }
        td.appendChild(inner);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    gridRoot.innerHTML = '';
    gridRoot.appendChild(table);
    tableEl = table;
  }

  function setTopRow(digits) {
    const row = tableEl.tBodies[0].rows[0];
    for (let c = 1; c <= 10; c++) {
      const cellInner = row.cells[c].firstChild;
      cellInner.textContent = String(digits[c - 1]);
    }
  }
  function setFirstColumn(digits) {
    for (let r = 1; r <= 10; r++) {
      const cellInner = tableEl.tBodies[0].rows[r].cells[0].firstChild;
      cellInner.textContent = String(digits[r - 1]);
    }
  }

  function setupYearSelect() {
    const yearSelect = document.getElementById('year-select');
    if (!yearSelect) return;
    yearSelect.addEventListener('change', (e) => {
      const url = e.target.value;
      if (url) window.location.href = url;
    });
    try {
      const dynamicHref = '/grid.html?boardID=' + encodeURIComponent(boardId);
      yearSelect.value = dynamicHref;
    } catch {}
  }

  function enhanceYearSelectLabels() {
    console.log('enhanceYearSelectLabels called');
    const DEFAULT_A = 'Team A';
    const DEFAULT_B = 'Team B';
    const select = document.getElementById('year-select');
    if (!select) {
      console.log('No year-select element found');
      return;
    }
    if (select.dataset.loaded === '1') {
      console.log('Dropdown already loaded, skipping');
      return;
    }
    select.dataset.loaded = '1'; // Set immediately to prevent concurrent calls
    const placeholder = select.querySelector('option[value=""]');
    const user = auth.currentUser;
    if (!user) {
      console.log('No user signed in');
      if (placeholder) placeholder.textContent = 'Sign in to view boards';
      return;
    }
    console.log('Loading boards for user:', user.uid);
    if (placeholder) placeholder.textContent = 'Loading contests...';
    const spinner = document.getElementById('year-loading');
    if (spinner) spinner.classList.remove('hidden');
    Array.from(select.options).forEach((opt) => { if ((opt.value || '') !== '') opt.remove(); });
    
    // Get user's accessed boards
    db.collection('users').doc(user.uid).get().then((userDoc) => {
      console.log('User doc exists:', userDoc.exists);
      const userData = userDoc.exists ? userDoc.data() : {};
      const accessedBoards = userData.accessedBoards || [];
      console.log('accessedBoards:', accessedBoards);
      
      if (accessedBoards.length === 0) {
        console.log('No boards in accessedBoards array');
        if (placeholder) placeholder.textContent = 'No boards accessed yet';
        if (spinner) spinner.classList.add('hidden');
        return;
      }
      
      // Load board data for each accessed board
      const promises = accessedBoards.map(boardId => 
        db.collection('grids').doc(boardId).get()
      );
      
      Promise.all(promises).then((docs) => {
        docs.forEach((doc) => {
          if (!doc.exists) return;
          const id = doc.id;
          const data = doc.data() || {};
          const a = data.teamA || DEFAULT_A;
          const b = data.teamB || DEFAULT_B;
          const label = data.label || id.substring(0, 8);
          const opt = document.createElement('option');
          opt.value = '/grid.html?boardID=' + encodeURIComponent(id);
          opt.textContent = `${label} — ${a} vs ${b}`;
          select.appendChild(opt);
        });
        
        if (placeholder) placeholder.textContent = 'Select Contest...';
        if (spinner) spinner.classList.add('hidden');
        select.dataset.loaded = '1';
        try {
          const currentHref = '/grid.html?boardID=' + encodeURIComponent(boardId);
          if (select.querySelector(`option[value="${currentHref}"]`)) {
            select.value = currentHref;
          }
        } catch {}
      }).catch((err) => {
        console.warn('Failed to load boards:', err);
        if (placeholder) placeholder.textContent = 'Select Contest...';
        if (spinner) spinner.classList.add('hidden');
        select.dataset.loaded = '1';
      });
    }).catch((err) => {
      console.warn('Failed to get user data:', err);
      if (placeholder) placeholder.textContent = 'Select Contest...';
      if (spinner) spinner.classList.add('hidden');
    });
  }

  function renderReservations(data) {
    const reservations = (data && data.reservations && typeof data.reservations === 'object') ? data.reservations : {};
    currentReservations = reservations;
    Object.entries(reservations).forEach(([key, val]) => {
      const parts = key.split('-');
      const r = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 10 || c < 1 || c > 10) return;
      const cellInner = tableEl.tBodies[0].rows[r].cells[c].firstChild;
      const isOwner = val && val.userId && (auth.currentUser && val.userId === auth.currentUser.uid);
      const labelHTML = formatLabelHTML((val && val.label) ? val.label : 'XXXXXXXX');
      
      // Add hover listeners for email tooltip
      const email = val && val.email;
      if (email) {
        cellInner.addEventListener('mouseenter', function() {
          hoverTimeout = setTimeout(() => {
            showEmailTooltip(email, cellInner);
          }, 5000);
        });
        cellInner.addEventListener('mouseleave', function() {
          hideEmailTooltip();
        });
      }
      
      if (isOwner) {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'cancel-link';
        a.dataset.r = String(r);
        a.dataset.c = String(c);
        a.innerHTML = labelHTML;
        cellInner.innerHTML = '';
        cellInner.appendChild(a);
        cellInner.classList.add('owner-selected');
      } else {
        cellInner.innerHTML = labelHTML;
        cellInner.classList.remove('owner-selected');
      }
    });
    setUserCount(countReservationsForCurrentUser(reservations));
    updateLockedUI();
  }

  function updateLockedUI() {
    if (lockedBanner) lockedBanner.classList.toggle('hidden', !isLocked);
    if (!tableEl) return;
    for (let r = 1; r <= 10; r++) {
      for (let c = 1; c <= 10; c++) {
        const key = r + '-' + c;
        const cellInner = tableEl.tBodies[0].rows[r].cells[c].firstChild;
        if (currentReservations[key]) continue;
        if (isLocked) {
          const reserve = cellInner.querySelector('.reserve-link');
          if (reserve) {
            cellInner.innerHTML = 'X';
          } else if (!cellInner.querySelector('.cancel-link')) {
            cellInner.textContent = 'X';
          }
        } else {
          const reserve = cellInner.querySelector('.reserve-link');
          const cancel = cellInner.querySelector('.cancel-link');
          if (!reserve && !cancel) {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'reserve-link';
            link.dataset.r = String(r);
            link.dataset.c = String(c);
            link.textContent = 'X';
            cellInner.innerHTML = '';
            cellInner.appendChild(link);
          }
        }
      }
    }
  }

  function renderScores(data) {
    if (!scoreboardEl) return;
    const q1 = (data && data.scoreQ1) || '';
    const q2 = (data && data.scoreQ2) || '';
    const q3 = (data && data.scoreQ3) || '';
    const final = (data && data.scoreFinal) || '';
    const any = !!(q1 || q2 || q3 || final);
    
    // Quarter colors - vibrant colors matching scoreboard
    const quarterColors = {
      'Q1': '#FFE119',
      'Q2': '#F032E6',
      'Q3': '#3CB44B',
      'F': '#E6194B'
    };
    
    // Clear all previous highlights
    if (tableEl) {
      for (let r = 1; r <= 10; r++) {
        for (let c = 1; c <= 10; c++) {
          const cellInner = tableEl.tBodies[0].rows[r].cells[c].firstChild;
          cellInner.classList.remove('q1-highlight', 'q2-highlight', 'q3-highlight', 'final-highlight');
          cellInner.style.background = '';
          const existingIndicator = cellInner.querySelector('.quarter-indicator');
          if (existingIndicator) existingIndicator.remove();
        }
      }
    }
    lastQ1Coord = null;
    lastQ2Coord = null;
    lastQ3Coord = null;
    lastFinalCoord = null;
    
    if (!any) {
      scoreboardEl.classList.add('hidden');
      scoreboardEl.innerHTML = '';
      return;
    }
    
    const parts = [];
    if (q1) parts.push('<span class="q1text">Q1 ' + q1 + '</span>');
    if (q2) parts.push('<span class="q2text">Q2 ' + q2 + '</span>');
    if (q3) parts.push('<span class="q3text">Q3 ' + q3 + '</span>');
    if (final) parts.push('<span class="finaltext">Final ' + final + '</span>');
    scoreboardEl.innerHTML = parts.join(' | ');
    scoreboardEl.classList.remove('hidden');
    
    // Parse score to get winning digits
    function parseScore(scoreStr) {
      if (!scoreStr) return null;
      const match = String(scoreStr).match(/(\d+)\D+(\d+)/) || String(scoreStr).match(/(\d)[^\d]*(\d)$/);
      if (!match) return null;
      const aNum = parseInt(match[1], 10);
      const bNum = parseInt(match[2], 10);
      if (Number.isNaN(aNum) || Number.isNaN(bNum)) return null;
      return {
        aLast: Math.abs(aNum) % 10,
        bLast: Math.abs(bNum) % 10
      };
    }
    
    // Find cell coordinates for a score
    function findWinningCell(scoreStr, topRow, firstColumn) {
      const parsed = parseScore(scoreStr);
      if (!parsed) return null;
      const cIndex = topRow.findIndex((d) => d === parsed.aLast);
      const rIndex = firstColumn.findIndex((d) => d === parsed.bLast);
      if (rIndex >= 0 && cIndex >= 0) {
        return { r: rIndex + 1, c: cIndex + 1 };
      }
      return null;
    }
    
    if (!Array.isArray(data.firstColumn) || data.firstColumn.length !== 10 ||
        !Array.isArray(data.topRow) || data.topRow.length !== 10 || !tableEl) {
      return;
    }
    
    // Collect all winning cells
    const winningCells = {}; // "r-c" -> array of quarters
    
    function addWinner(coord, quarter) {
      if (!coord) return;
      const key = coord.r + '-' + coord.c;
      if (!winningCells[key]) winningCells[key] = [];
      winningCells[key].push(quarter);
    }
    
    if (q1) addWinner(findWinningCell(q1, data.topRow, data.firstColumn), 'Q1');
    if (q2) addWinner(findWinningCell(q2, data.topRow, data.firstColumn), 'Q2');
    if (q3) addWinner(findWinningCell(q3, data.topRow, data.firstColumn), 'Q3');
    if (final) addWinner(findWinningCell(final, data.topRow, data.firstColumn), 'F');
    
    // Apply backgrounds and indicators
    Object.entries(winningCells).forEach(([key, quarters]) => {
      const parts = key.split('-');
      const r = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      const cellInner = tableEl.tBodies[0].rows[r].cells[c].firstChild;
      const count = quarters.length;
      
      // Apply gradient background
      if (count === 1) {
        cellInner.style.background = quarterColors[quarters[0]];
      } else if (count === 2) {
        cellInner.style.background = `linear-gradient(to right, ${quarterColors[quarters[0]]} 0%, ${quarterColors[quarters[0]]} 50%, ${quarterColors[quarters[1]]} 50%, ${quarterColors[quarters[1]]} 100%)`;
      } else if (count === 3) {
        cellInner.style.background = `linear-gradient(to right, ${quarterColors[quarters[0]]} 0%, ${quarterColors[quarters[0]]} 33.33%, ${quarterColors[quarters[1]]} 33.33%, ${quarterColors[quarters[1]]} 66.66%, ${quarterColors[quarters[2]]} 66.66%, ${quarterColors[quarters[2]]} 100%)`;
      } else if (count === 4) {
        cellInner.style.background = `linear-gradient(to right, ${quarterColors[quarters[0]]} 0%, ${quarterColors[quarters[0]]} 25%, ${quarterColors[quarters[1]]} 25%, ${quarterColors[quarters[1]]} 50%, ${quarterColors[quarters[2]]} 50%, ${quarterColors[quarters[2]]} 75%, ${quarterColors[quarters[3]]} 75%, ${quarterColors[quarters[3]]} 100%)`;
      }
    });
  }

  function resetCellToX(r, c) {
    const cellInner = tableEl.tBodies[0].rows[r].cells[c].firstChild;
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'reserve-link';
    link.dataset.r = String(r);
    link.dataset.c = String(c);
    link.textContent = 'X';
    cellInner.innerHTML = '';
    cellInner.appendChild(link);
    cellInner.classList.remove('owner-selected');
  }

  function reserveSquare(r, c, label) {
    const ref = db.collection('grids').doc(boardId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const reservations = (data && data.reservations && typeof data.reservations === 'object') ? data.reservations : {};
      const key = `${r}-${c}`;
      if (reservations[key]) throw new Error('already_reserved');
      const entry = {
        userId: auth.currentUser?.uid || 'unknown',
        email: auth.currentUser?.email || '',
        label,
        reservedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!snap.exists) {
        const payload = { reservations: {} };
        payload.reservations[key] = entry;
        payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        tx.set(ref, payload, { merge: true });
      } else {
        if (!(data && typeof data.reservations === 'object' && data.reservations !== null && !Array.isArray(data.reservations))) {
          tx.update(ref, { reservations: {} });
        }
        const payload = {};
        payload['reservations.' + key] = entry;
        payload['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
        tx.update(ref, payload);
      }
    });
  }

  function cancelSquare(r, c) {
    const ref = db.collection('grids').doc(boardId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const reservations = (data && data.reservations && typeof data.reservations === 'object') ? data.reservations : {};
      const key = `${r}-${c}`;
      const entry = reservations[key];
      if (!entry) throw new Error('not_reserved');
      if (entry.userId !== (auth.currentUser?.uid || '')) throw new Error('not_owner');
      const payload = {};
      payload['reservations.' + key] = firebase.firestore.FieldValue.delete();
      payload['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
      tx.update(ref, payload);
    });
  }

  function init() {
    if (!boardId) return;
    renderGrid();
    reorderLayout();

    // Update Home link
    const homeLink = document.querySelector('a.btn-link[href="/index.html"]');
    if (homeLink) {
      homeLink.href = '/index.html';
    }

    async function checkPasswordAccess(boardData) {
      const boardPassword = boardData.password || '';
      if (!boardPassword) return true; // no password required
      
      const storedPassword = getStoredPassword(boardId);
      
      if (storedPassword === boardPassword) {
        return true;
      }
      
      // Loop until correct password or user cancels
      while (true) {
        const enteredPassword = prompt('This board is password protected. Enter password:');
        if (!enteredPassword) return false; // user cancelled
        
        if (enteredPassword === boardPassword) {
          storePassword(boardId, enteredPassword);
          return true;
        } else {
          alert('Incorrect password. Please try again.');
        }
      }
    }

    // Setup share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        // Get board data including short code and password
        let password = '';
        let shortCode = '';
        try {
          const doc = await loadGridDoc();
          if (doc.exists) {
            const data = doc.data() || {};
            if (data.password) {
              password = data.password;
            }
            if (data.shortCode) {
              shortCode = data.shortCode;
            }
          }
        } catch (e) {
          console.error('Failed to fetch board data:', e);
        }
        
        // Use short code URL if available, otherwise use board ID
        const url = shortCode 
          ? window.location.origin + '/grid.html?code=' + encodeURIComponent(shortCode)
          : window.location.origin + '/grid.html?boardID=' + encodeURIComponent(boardId);
        
        const textToCopy = password ? `${url}\npassword = ${password}` : url;
        
        try {
          await navigator.clipboard.writeText(textToCopy);
          showToast('URL and password copied to clipboard');
        } catch {
          // Fallback for browsers that don't support clipboard API
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('URL and password copied to clipboard');
          } catch (err) {
            document.body.removeChild(textArea);
            prompt('Copy this URL and password:', textToCopy);
          }
        }
      });
    }

    // Setup print button
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', async () => {
        const doc = await loadGridDoc();
        if (!doc.exists) {
          showToast('Grid data not found');
          return;
        }
        
        const data = doc.data() || {};
        const label = data.label || 'Grid';
        const teamA = data.teamA || 'Team A';
        const teamB = data.teamB || 'Team B';
        const firstColumn = data.firstColumn || [];
        const topRow = data.topRow || [];
        const reservations = data.reservations || {};
        const scoreQ1 = data.scoreQ1 || '';
        const scoreQ2 = data.scoreQ2 || '';
        const scoreQ3 = data.scoreQ3 || '';
        const scoreFinal = data.scoreFinal || '';
        
        // Open a new window with print-optimized layout
        const printWindow = window.open('', '_blank', 'width=850,height=1100');
        if (!printWindow) {
          showToast('Please allow popups to print');
          return;
        }
        
        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>${label} - ${teamA} vs ${teamB}</title>
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      text-align: center;
    }
    .teams {
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 20px;
    }
    .grid-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .team-a-label {
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
    }
    .grid-container {
      display: flex;
      gap: 8px;
    }
    .team-b-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(11, 1fr);
      grid-template-rows: repeat(11, 1fr);
      gap: 0;
      border: 2px solid #333;
      max-width: 700px;
      aspect-ratio: 1;
    }
    .cell {
      border: 1px solid #999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 500;
      padding: 4px;
      word-wrap: break-word;
      overflow: hidden;
      text-align: center;
      background: white;
      position: relative;
    }
    .cell.header {
      background: #e0e0e0;
      font-weight: 700;
      font-size: 13px;
    }
    .cell.reserved {
      background: #d4edda;
      font-size: 9px;
      line-height: 1.2;
    }
    .cell.winner-q1 {
      background: #cfe2ff;
    }
    .cell.winner-q2 {
      background: #fff3cd;
    }
    .cell.winner-q3 {
      background: #ffe5d0;
    }
    .cell.winner-f {
      background: #d1e7dd;
    }
    .cell.pending {
      color: #999;
      font-size: 16px;
      font-weight: 300;
    }
    .pending-indicator {
      position: absolute;
      bottom: 2px;
      right: 3px;
      font-size: 10px;
      color: #999;
    }
    @media print {
      body {
        padding: 0;
      }
      @page {
        margin: 0.5in;
      }
    }
  </style>
</head>
<body>
  <h1>${label}</h1>
  <div class="teams">${teamA} vs ${teamB}</div>
  <div class="grid-wrapper">
    <div class="team-a-label">${teamA}</div>
    <div class="grid-container">
      <div class="team-b-label">${teamB}</div>
      <div class="grid" id="print-grid"></div>
    </div>
  </div>
  <script>
    const firstColumn = ${JSON.stringify(firstColumn)};
    const topRow = ${JSON.stringify(topRow)};
    const reservations = ${JSON.stringify(reservations)};
    const scoreQ1 = ${JSON.stringify(scoreQ1)};
    const scoreQ2 = ${JSON.stringify(scoreQ2)};
    const scoreQ3 = ${JSON.stringify(scoreQ3)};
    const scoreFinal = ${JSON.stringify(scoreFinal)};
    
    // Parse scores and find winning cells
    function parseScore(scoreStr) {
      if (!scoreStr || typeof scoreStr !== 'string') return null;
      const parts = scoreStr.split('-');
      if (parts.length !== 2) return null;
      const teamAScore = parseInt(parts[0], 10);
      const teamBScore = parseInt(parts[1], 10);
      if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore)) return null;
      return {
        teamADigit: teamAScore % 10,
        teamBDigit: teamBScore % 10
      };
    }
    
    const winningCells = {}; // key -> array of quarters
    const q1 = parseScore(scoreQ1);
    const q2 = parseScore(scoreQ2);
    const q3 = parseScore(scoreQ3);
    const final = parseScore(scoreFinal);
    
    // Find which row/col index corresponds to each digit
    function findWinningCell(teamADigit, teamBDigit) {
      const col = topRow.indexOf(teamADigit);
      const row = firstColumn.indexOf(teamBDigit);
      if (col >= 0 && row >= 0) {
        const key = (row + 1) + '-' + (col + 1);
        return key;
      }
      return null;
    }
    
    function addWinner(key, quarter) {
      if (!key) return;
      if (!winningCells[key]) winningCells[key] = [];
      winningCells[key].push(quarter);
    }
    
    if (q1) addWinner(findWinningCell(q1.teamADigit, q1.teamBDigit), 'Q1');
    if (q2) addWinner(findWinningCell(q2.teamADigit, q2.teamBDigit), 'Q2');
    if (q3) addWinner(findWinningCell(q3.teamADigit, q3.teamBDigit), 'Q3');
    if (final) addWinner(findWinningCell(final.teamADigit, final.teamBDigit), 'F');
    
    // Quarter colors - vibrant colors matching scoreboard
    const quarterColors = {
      'Q1': '#FFE119',
      'Q2': '#F032E6',
      'Q3': '#3CB44B',
      'F': '#E6194B'
    };
    
    const grid = document.getElementById('print-grid');
    
    // Top-left corner cell
    const cornerCell = document.createElement('div');
    cornerCell.className = 'cell header';
    grid.appendChild(cornerCell);
    
    // Top row headers
    for (let col = 0; col < 10; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell header';
      const hasNumber = topRow[col] !== undefined && topRow[col] !== null && topRow[col] !== '';
      if (hasNumber) {
        cell.textContent = topRow[col];
      } else {
        const indicator = document.createElement('span');
        indicator.className = 'pending-indicator';
        indicator.textContent = '?';
        cell.appendChild(indicator);
      }
      grid.appendChild(cell);
    }
    
    // Rows with left column header + data cells
    for (let row = 0; row < 10; row++) {
      // Left column header
      const headerCell = document.createElement('div');
      headerCell.className = 'cell header';
      const hasNumber = firstColumn[row] !== undefined && firstColumn[row] !== null && firstColumn[row] !== '';
      if (hasNumber) {
        headerCell.textContent = firstColumn[row];
      } else {
        const indicator = document.createElement('span');
        indicator.className = 'pending-indicator';
        indicator.textContent = '?';
        headerCell.appendChild(indicator);
      }
      grid.appendChild(headerCell);
      
      // Data cells
      for (let col = 0; col < 10; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        // Keys are 1-based (1-10), not 0-based
        const key = (row + 1) + '-' + (col + 1);
        if (reservations[key]) {
          cell.className = 'cell reserved';
          cell.textContent = reservations[key].label || '';
        }
        // Add quarter indicator and background if this is a winning cell
        if (winningCells[key]) {
          const quarters = winningCells[key];
          const count = quarters.length;
          
          // Create vertical stripe gradient if multiple winners
          if (count === 1) {
            cell.style.background = quarterColors[quarters[0]];
          } else if (count === 2) {
            cell.style.background = \`linear-gradient(to right, \${quarterColors[quarters[0]]} 0%, \${quarterColors[quarters[0]]} 50%, \${quarterColors[quarters[1]]} 50%, \${quarterColors[quarters[1]]} 100%)\`;
          } else if (count === 3) {
            cell.style.background = \`linear-gradient(to right, \${quarterColors[quarters[0]]} 0%, \${quarterColors[quarters[0]]} 33.33%, \${quarterColors[quarters[1]]} 33.33%, \${quarterColors[quarters[1]]} 66.66%, \${quarterColors[quarters[2]]} 66.66%, \${quarterColors[quarters[2]]} 100%)\`;
          } else if (count === 4) {
            cell.style.background = \`linear-gradient(to right, \${quarterColors[quarters[0]]} 0%, \${quarterColors[quarters[0]]} 25%, \${quarterColors[quarters[1]]} 25%, \${quarterColors[quarters[1]]} 50%, \${quarterColors[quarters[2]]} 50%, \${quarterColors[quarters[2]]} 75%, \${quarterColors[quarters[3]]} 75%, \${quarterColors[quarters[3]]} 100%)\`;
          }
          
          // Add text indicators in different corners
          const positions = [
            { bottom: '2px', right: '3px' },     // bottom-right
            { top: '2px', right: '3px' },        // top-right
            { bottom: '2px', left: '3px' },      // bottom-left
            { top: '2px', left: '3px' }          // top-left
          ];
          
          quarters.forEach((quarter, idx) => {
            const indicator = document.createElement('span');
            indicator.style.position = 'absolute';
            indicator.style.fontSize = '10px';
            indicator.style.color = '#000';
            indicator.style.fontWeight = '700';
            indicator.textContent = quarter;
            Object.assign(indicator.style, positions[idx]);
            cell.appendChild(indicator);
          });
        }
        grid.appendChild(cell);
      }
    }
    
    // Auto-print on load
    window.onload = () => {
      window.print();
    };
  </script>
</body>
</html>
        `);
        printWindow.document.close();
      });
    }

    let initialGridLoaded = false;
    let lastUserId = null;
    let isFirstAuthChange = true;
    
    // Wait for auth to initialize before loading grid
    auth.onAuthStateChanged(async () => {
      const currentUserId = auth.currentUser?.uid || null;
      console.log('Auth state changed. Last:', lastUserId, 'Current:', currentUserId, 'isFirst:', isFirstAuthChange);
      
      // Check if user just logged in and track any pending board access
      if (currentUserId && lastUserId === null) {
        try {
          const pendingBoardId = localStorage.getItem('lastBoardAccessed');
          if (pendingBoardId) {
            console.log('User logged in, tracking pending board:', pendingBoardId);
            await trackBoardAccess(pendingBoardId);
            localStorage.removeItem('lastBoardAccessed');
          }
        } catch (e) {
          console.warn('Failed to track pending board access:', e);
        }
      }
      
      // Load grid on first auth state change
      if (!initialGridLoaded) {
        initialGridLoaded = true;
        loadInitialGrid();
      }
      
      // Clear passwords only when switching between different actual users
      // Don't clear on initial page load or on logout->login same user
      if (!isFirstAuthChange && lastUserId !== null && currentUserId !== null && lastUserId !== currentUserId) {
        console.log('User switched, clearing passwords. Old:', lastUserId, 'New:', currentUserId);
        clearStoredPasswords();
      } else if (!isFirstAuthChange && lastUserId !== null && currentUserId === null) {
        // User logged out
        console.log('User logged out, clearing passwords');
        clearStoredPasswords();
      } else {
        console.log('Not clearing passwords - reason:', isFirstAuthChange ? 'first auth' : 'same user or page load');
      }
      
      lastUserId = currentUserId;
      
      // On subsequent auth changes (not first), reload grid data
      if (!isFirstAuthChange) {
        loadGridDoc().then((doc) => {
          if (!doc.exists) return;
          const data = doc.data() || {};
          isLocked = !!data.locked;
          renderReservations(data);
          renderScores(data);
          reorderLayout();
          try {
            const el = document.getElementById('user-tag-footer');
            if (el) {
              const user = auth.currentUser;
              if (user) {
                const email = user.email || '';
                const adminHref = '/admin.html';
                el.innerHTML = `Welcome ${email} <a href="${adminHref}" class="admin-link" style="margin-left:8px;">Admin</a>`;
              } else {
                el.textContent = 'Not signed in';
              }
              el.classList.remove('hidden');
            }
          } catch {}
        }).catch(() => {});
      }
      
      isFirstAuthChange = false;
      
      // Only enhance dropdown once on init, not on every auth change
      if (lastUserId === currentUserId && lastUserId !== null) {
        // Skip dropdown enhancement on subsequent auth changes for same user
      } else {
        // Reset the loaded flag when user changes so dropdown can refresh
        const select = document.getElementById('year-select');
        if (select) select.dataset.loaded = '0';
        enhanceYearSelectLabels();
      }
    });

    function loadInitialGrid() {
      loadGridDoc().then(async (doc) => {
        if (!doc.exists) {
          console.error('Board document does not exist for boardId:', boardId);
          showToast('Board not found');
          return;
        }
        const data = doc.data() || {};
        
        // Track board access
        trackBoardAccess(boardId);
        
        // Load team names and title regardless of password
        if (Array.isArray(data.topRow) && data.topRow.length === 10) setTopRow(data.topRow);
        if (Array.isArray(data.firstColumn) && data.firstColumn.length === 10) setFirstColumn(data.firstColumn);
        const teamATitleEl = document.querySelector('.grid-title');
        const teamBLabelEl = document.querySelector('.team-b-label');
        if (teamATitleEl) teamATitleEl.textContent = data.teamA || 'Team A';
        if (teamBLabelEl) teamBLabelEl.textContent = data.teamB || 'Team B';
        try {
          const DEFAULT_A = 'Team A';
          const DEFAULT_B = 'Team B';
          const base = data.label || boardId.substring(0, 8);
          const a = data.teamA || DEFAULT_A;
          const b = data.teamB || DEFAULT_B;
          const text = `${base} — ${a} vs ${b}`;
          console.log('Setting title:', base, 'teamA:', a, 'teamB:', b);
          console.log('boardTitleEl:', boardTitleEl, 'teamAEl:', teamAEl, 'teamBEl:', teamBEl);
          if (boardTitleEl) boardTitleEl.textContent = base;
          if (teamAEl) teamAEl.textContent = a;
          if (teamBEl) teamBEl.textContent = b;
          try { document.title = `Squares Grid — ${text}`; } catch {}
        } catch (err) {
          console.error('Error setting title/teams:', err);
        }
        
        // Check password access
        const hasAccess = await checkPasswordAccess(data);
        if (!hasAccess) {
          hasPasswordAccess = false;
          showToast('Access denied - Password required');
          return;
        }
        hasPasswordAccess = true;
        
        isLocked = !!data.locked;
        renderReservations(data);
        renderScores(data);
        reorderLayout();
        try {
          const el = document.getElementById('user-tag-footer');
          if (el) {
            const user = auth.currentUser;
            if (user) {
              const email = user.email || '';
              const adminHref = '/admin.html';
              el.innerHTML = `Welcome ${email} <a href="${adminHref}" class="admin-link" style="margin-left:8px;">Admin</a>`;
            } else {
              el.textContent = 'Not signed in';
            }
            el.classList.remove('hidden');
          }
        } catch {}
      }).catch((err) => console.warn('Load grid failed:', err));
    }

    gridRoot.addEventListener('click', async (e) => {
      const reserve = e.target.closest('.reserve-link');
      if (reserve) {
        e.preventDefault();
        if (!hasPasswordAccess) {
          alert('You do not have access to this board. Please enter the correct password.');
          // Re-load grid doc to trigger password prompt
          loadGridDoc().then(async (doc) => {
            if (!doc.exists) return;
            const data = doc.data() || {};
            const hasAccess = await checkPasswordAccess(data);
            if (hasAccess) {
              hasPasswordAccess = true;
            }
          }).catch(() => {});
          return;
        }
        const user = auth.currentUser;
        if (!user) { alert('Please sign in on Home before reserving.'); return; }
        const r = parseInt(reserve.dataset.r, 10);
        const c = parseInt(reserve.dataset.c, 10);
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 10 || c < 1 || c > 10) return;
        const ok = confirm('Reserve this square?');
        if (!ok) return;
        const label = getUserLabel(user);
        try {
          await reserveSquare(r, c, label);
          const cellInner = tableEl.tBodies[0].rows[r].cells[c].firstChild;
          const a = document.createElement('a');
          a.href = '#';
          a.className = 'cancel-link';
          a.dataset.r = String(r);
          a.dataset.c = String(c);
          a.innerHTML = formatLabelHTML(label);
          cellInner.innerHTML = '';
          cellInner.appendChild(a);
          cellInner.classList.add('owner-selected');
          currentReservations[r + '-' + c] = { userId: auth.currentUser?.uid || '', label };
          setUserCount(userReservationCount + 1);
        } catch (err) {
          const msg = (err && err.message) || '';
          const code = (err && err.code) || '';
          if (msg === 'already_reserved') {
            alert('Sorry, that square is already reserved.');
          } else {
            alert('Reservation failed: ' + (code || msg || 'unknown error'));
            console.warn('Reserve error:', err);
          }
        }
        return;
      }
      const cancel = e.target.closest('.cancel-link');
      if (cancel) {
        e.preventDefault();
        if (!hasPasswordAccess) {
          alert('You do not have access to this board. Please enter the correct password.');
          // Re-load grid doc to trigger password prompt
          loadGridDoc().then(async (doc) => {
            if (!doc.exists) return;
            const data = doc.data() || {};
            const hasAccess = await checkPasswordAccess(data);
            if (hasAccess) {
              hasPasswordAccess = true;
            }
          }).catch(() => {});
          return;
        }
        const user = auth.currentUser;
        if (!user) { alert('Please sign in to manage your reservation.'); return; }
        const r = parseInt(cancel.dataset.r, 10);
        const c = parseInt(cancel.dataset.c, 10);
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 10 || c < 1 || c > 10) return;
        const ok = confirm('Cancel your reservation for this square?');
        if (!ok) return;
        try {
          await cancelSquare(r, c);
          resetCellToX(r, c);
          delete currentReservations[r + '-' + c];
          setUserCount(Math.max(0, userReservationCount - 1));
        } catch (err) {
          if (err && err.message === 'not_owner') {
            alert('Only the original reserver can cancel this.');
          } else if (err && err.message === 'not_reserved') {
            alert('This square is not currently reserved.');
          } else {
            alert('Cancel failed. It may require rule updates.');
            console.warn('Cancel error:', err);
          }
        }
        return;
      }
    });

    setupYearSelect();
    // Don't call enhanceYearSelectLabels here - let auth state handler do it
  }

  // init() is now called from initializeBoardId after board ID is resolved
})();
