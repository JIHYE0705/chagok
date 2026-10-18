// Design-only fixtures. No account, extraction, storage, or server writes.
const recipes = [
  { id: 'gimbap', title: '땡초김밥', summary: '잘게 다진 채소와 어묵으로 만드는 매콤한 김밥.', tags: ['도시락', '집밥'], date: '2026.10.18', favorite: true, image: 'https://static.wtable.co.kr/image/production/service/recipe/1430/0f4ee459-9c66-4d5a-9770-69c5af9f4d4c.jpg?size=800x800', source: '우리의식탁 · 공개 레시피', url: 'https://wtable.co.kr/recipes/314wwQZR5hXP4RMCEKzJMHfa' },
  { id: 'sweet-potato', title: '고구마 누룽지', summary: '얇게 펴서 바삭하게 굽는 간식. 원문에 없는 분량과 조리 조건은 비워 두었어요.', tags: ['간식', '다시 만들기'], date: '2026.10.17', favorite: false, source: '텍스트 · 기존 테스트 예시' },
  { id: 'long-title', title: '냉장고 속 남은 재료로 만드는 주말 한 끼 — 바쁜 날에도 꺼내 보기 좋은 초간단 레시피와 재료 보관 팁까지 차곡차곡 모아 두기', summary: 'SNS에서 가져온 긴 제목을 가정한 표시 예시예요. 전체 제목은 눌러서 확인할 수 있어요.', tags: ['집밥'], date: '2026.10.16', favorite: true, source: '긴 제목 · 표시 검증 예시' },
  { id: 'soup', title: '감자 수프', summary: '감자 200 g · 소금 약간. 분량과 단위가 섞인 글을 읽어보세요.', tags: ['집밥'], date: '2026.10.15', favorite: false, source: '텍스트 · 기존 테스트 예시' },
];
const content = document.getElementById('content');
const params = new URLSearchParams(location.search);
let direction = ['a', 'b', 'b2'].includes(params.get('direction')) ? params.get('direction') : 'a';
let libraryView = 'cards';
try { if (localStorage.getItem('chagok:library-view') === 'list') libraryView = 'list'; } catch { /* View selection works without storage. */ }
document.body.dataset.view = libraryView;
let filter = 'all';
let query = '';
const drafts = new Map();
const fontFamilies = { pretendard: 'Pretendard, sans-serif', noto: '"Noto Sans KR", sans-serif', gowun: 'GowunPreview, sans-serif' };
function setDirection(value) {
  direction = value;
  document.body.dataset.direction = value;
  document.querySelectorAll('.switcher button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === value)));
  const url = new URL(location.href);
  url.searchParams.set('direction', value);
  history.replaceState(null, '', url);
  if (content.childElementCount) renderPage();
}
document.querySelectorAll('.switcher button').forEach(button => button.addEventListener('click', () => setDirection(button.dataset.direction)));
document.getElementById('font').addEventListener('change', event => {
  if (fontFamilies[event.target.value]) document.body.style.setProperty('--font', fontFamilies[event.target.value]);
  else document.body.style.removeProperty('--font');
});
function renderCards() {
  const grid = content.querySelector('.recipe-grid');
  if (!grid) return;
  const visible = recipes.filter(recipe => (filter === 'all' || (filter === 'favorite' ? recipe.favorite : recipe.tags.includes(filter))) && [recipe.title, recipe.summary, ...recipe.tags].join(' ').toLowerCase().includes(query.toLowerCase()));
  const sorted = content.querySelector('.sort-label select').selectedIndex === 1 ? visible.toSorted((a,b) => a.title.localeCompare(b.title, 'ko')) : visible;
  grid.replaceChildren();
  sorted.forEach(recipe => {
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.classList.toggle('text-only', !recipe.image);
    // Fixture text is assigned as textContent below, including the deliberately long title.
    card.innerHTML = `<a class="cover" href="#detail"><div class="no-photo" style="width:100%;height:100%"><span class="paper-mark" aria-hidden="true">≋</span><span>텍스트로 담은 레시피</span></div></a><div class="card-content"><p class="card-meta"><span></span><time></time></p><h2><a href="#detail"></a></h2><p class="card-summary"></p><div class="card-bottom"><div class="tags"></div><button type="button" class="favorite"></button></div></div>`;
    const cover = card.querySelector('.cover');
    cover.setAttribute('aria-label', `${recipe.title} 상세 보기`);
    if (recipe.image) {
      const image = document.createElement('img');
      image.src = recipe.image; image.alt = '우리의식탁 땡초김밥'; image.width = 800; image.height = 800;
      image.addEventListener('error', () => image.remove(), { once: true });
      cover.prepend(image);
      const credit = document.createElement('span'); credit.className = 'cover-credit'; credit.textContent = '사진 · 우리의식탁'; cover.append(credit);
    }
    const titleLink = card.querySelector('h2 a');
    titleLink.textContent = recipe.title;
    if (recipe.url) { titleLink.href = recipe.url; titleLink.target = '_blank'; titleLink.rel = 'noopener noreferrer'; cover.href = recipe.url; cover.target = '_blank'; cover.rel = 'noopener noreferrer'; }
    else if (recipe.id !== 'sweet-potato') { titleLink.href = `#detail-${recipe.id}`; cover.href = titleLink.href; }
    card.querySelector('.card-meta span').textContent = recipe.source;
    card.querySelector('time').textContent = recipe.date;
    card.querySelector('time').dateTime = recipe.date.replaceAll('.', '-');
    card.querySelector('.card-summary').textContent = recipe.summary;
    recipe.tags.forEach(tag => { const span = document.createElement('span'); span.textContent = tag; card.querySelector('.tags').append(span); });
    const favorite = card.querySelector('.favorite');
    favorite.textContent = recipe.favorite ? '♥' : '♡';
    favorite.setAttribute('aria-pressed', String(recipe.favorite));
    favorite.setAttribute('aria-label', `${recipe.title} 즐겨찾기`);
    favorite.addEventListener('click', () => { recipe.favorite = !recipe.favorite; renderCards(); });
    grid.append(card);
  });
  content.querySelector('.empty').hidden = sorted.length > 0;
  content.querySelector('#result-count').textContent = direction === 'b2' ? `${sorted.length}개` : `담아 둔 발견 ${sorted.length}개`;
  content.querySelectorAll('.favorite-count').forEach(el => el.textContent = recipes.filter(recipe => recipe.favorite).length);
  content.querySelectorAll('[data-filter]').forEach(button => { const selected = button.dataset.filter === filter; button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('selected', selected); });
}
function renderPage(moveFocus = false) {
  if (content.querySelector('#recipe-form')) content.querySelectorAll('input, textarea, select').forEach(field => drafts.set(field.id, field.value));
  const hash = location.hash.slice(1);
  const page = hash.startsWith('detail') ? 'detail' : hash === 'editor' ? 'editor' : 'library';
  content.replaceChildren(document.getElementById(`${page}-template`).content.cloneNode(true));
  document.querySelectorAll('[data-page]').forEach(link => { if(link.dataset.page === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  if (page === 'library') {
    content.querySelector('#search').value = query;
    content.querySelector('.search').addEventListener('submit', event => { event.preventDefault(); query = content.querySelector('#search').value.trim(); renderCards(); });
    content.querySelector('#search').addEventListener('input', event => { query = event.target.value; renderCards(); });
    content.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderCards(); }));
    content.querySelector('.sort-label select').addEventListener('change', renderCards);
    content.querySelector('#clear-search').addEventListener('click', () => { query = ''; filter = 'all'; content.querySelector('#search').value = ''; renderCards(); });
    renderCards();
  }
  if (page === 'detail') {
    const alternate = recipes.find(recipe => `detail-${recipe.id}` === hash);
    if (alternate) {
      content.querySelector('h1').textContent = alternate.title;
      content.querySelector('.intro').textContent = alternate.summary;
      content.querySelector('.detail-layout').hidden = true;
      content.querySelector('.detail-title .caption').textContent = '표시 검증용 예시 · 조리 정보는 입력하지 않았어요.';
      content.querySelector('.tags').replaceChildren(...alternate.tags.map(tag => { const span = document.createElement('span'); span.textContent = tag; return span; }));
      content.querySelector('.detail-actions a').hidden = true;
    }
    const favorite = content.querySelector('#detail-favorite');
    const recipe = alternate || recipes.find(entry => entry.id === 'sweet-potato');
    const sync = () => { favorite.setAttribute('aria-pressed', String(recipe.favorite)); favorite.textContent = `${recipe.favorite ? '♥' : '♡'} 즐겨찾기`; };
    sync(); favorite.addEventListener('click', () => { recipe.favorite = !recipe.favorite; sync(); });
  }
  if (page === 'editor') {
    content.querySelectorAll('input, textarea, select').forEach(field => { if(drafts.has(field.id)) field.value = drafts.get(field.id); });
    content.querySelector('#recipe-form').addEventListener('submit', event => { event.preventDefault(); content.querySelector('#save-status').textContent = '입력 화면 예시예요. 실제 저장은 하지 않았으며 입력은 이 페이지에서 유지돼요.'; });
    content.querySelector('#capture-kind').addEventListener('change', () => { content.querySelector('#save-status').textContent = '입력 방식의 모양을 비교하는 시안이에요. 링크 수집은 연결하지 않았어요.'; });
  }
  content.querySelectorAll('[data-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.view === libraryView));
    button.addEventListener('click', () => {
      libraryView = button.dataset.view;
      document.body.dataset.view = libraryView;
      try { localStorage.setItem('chagok:library-view', libraryView); } catch { /* View selection works without storage. */ }
      content.querySelectorAll('[data-view]').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.view === libraryView)));
    });
  });
  if (direction === 'b2') refineNotebook(page);
  if (moveFocus) { content.focus({preventScroll:true}); window.scrollTo(0, 0); }
}
function refineNotebook(page) {
  if (page === 'library') {
    content.querySelector('.intro').textContent = '다음에 또 만들어 먹을 것들.';
    content.querySelector('#search').placeholder = '제목이나 재료로 찾기';
    content.querySelector('.empty h2').textContent = '찾는 레시피가 없어요';
    content.querySelector('.empty p').textContent = '검색어를 바꾸거나 전체 목록을 확인해 보세요.';
  }
  if (page === 'detail') {
    content.querySelector('.ingredient-section .note strong').textContent = '원문에 없는 정보';
    content.querySelector('.ingredient-section .note p').textContent = '인분·시간·온도는 미기재예요.';
  }
  if (page === 'editor') {
    content.querySelector('h1').textContent = '레시피 담기';
    content.querySelector('.intro').textContent = '가져온 내용과 내가 정리한 내용을 나란히 봐요.';
    content.querySelector('.editor-source h2').textContent = '가져온 내용';
    content.querySelector('.editor-result h2').textContent = '저장할 내용';
    content.querySelector('.editor-source .note strong').textContent = '분량을 모르면 빈칸으로';
    content.querySelector('.editor-source .note p').textContent = '적지 않아도 저장할 수 있어요.';
  }
}
setDirection(direction);
window.addEventListener('hashchange', () => { if (location.hash !== '#content') renderPage(true); });
renderPage();
